import { basename } from "path";
import { serializeError } from "serialize-error";
import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Speech } from "@bubby/core/interfaces/ai";
import * as core from "@bubby/core/interfaces/chat";
import {
  buildMaskedUrlForFile,
  extractFileIdFromMaskedUrl,
} from "@bubby/core/utils";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";
import { User } from "./user";

export abstract class Chat<
  T extends Update.MessageUpdate = Update.MessageUpdate
> implements core.Chat
{
  protected channelId: string;
  protected errors: any[] = [];

  protected replyCountNonSystem = 0;
  protected replyCountSystem = 0;
  protected replyPromises: Promise<any>[] = [];
  protected replySystemInProgressMessageId: number | undefined;
  protected replySystemMessageIds: number[] = [];

  constructor(protected ctx: Context<T>, protected user: User) {
    this.channelId = `${ctx.chat.id}`;
  }

  getChannelId() {
    return this.channelId;
  }

  onError(error: any, info: object = {}) {
    this.errors.push(error);
    console.error({ ...info, error });
  }

  async reply(reply: core.Reply) {
    this.stopSystemMessageTimer();
    await this.replyInternal(reply);
  }

  protected async replyInternal(reply: core.Reply) {
    const { channelId, ctx } = this;

    switch (reply.type) {
      case "markdown":
        const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
        console.log({ channelId, reply, safeHtml });
        await this.replyWrapper(reply.type, ctx.replyWithHTML(safeHtml));
        break;
      case "photo":
        console.log({ channelId, reply });
        const { caption, url } = reply;
        await this.replyWrapper(
          reply.type,
          ctx.replyWithPhoto({ url }, { caption })
        );
        break;
      case "system":
        console.log({ channelId, reply });
        const systemMessage = await this.replyWrapper(
          reply.type,
          ctx.reply(reply.system, { disable_notification: true })
        );
        if (typeof systemMessage !== "undefined") {
          const systemMessageId = systemMessage.message_id;
          this.replySystemMessageIds.push(systemMessageId);
          this.startSystemMessageTimer(systemMessageId, reply.system);
        }
        break;
      default:
        console.warn("Unknown reply type", { channelId, reply });
    }
  }

  async replySendFinal() {
    const { channelId, ctx, errors } = this;

    this.stopSystemMessageTimer();
    await Promise.all(this.replyPromises);

    if (this.replyCountNonSystem === 0 && errors.length > 0) {
      const somethingWentWrong =
        "🚨 Something went wrong, please try again later.";
      let informedAdmin = false;

      if (errors.length > 0 && this.user.isAdmin()) {
        try {
          const json = JSON.stringify(errors.map((e) => serializeError(e)));
          const filename = `errors-${ctx.message.message_id}.json`;
          await ctx.replyWithDocument(
            { source: Buffer.from(json), filename },
            { caption: somethingWentWrong }
          );
          informedAdmin = true;
        } catch (informAdminError) {
          console.error({ informAdminError });
        }
      }

      if (!informedAdmin) {
        await ctx.reply(somethingWentWrong);
      }
    }

    if (this.replyCountNonSystem > 0) {
      for (const messageId of this.replySystemMessageIds) {
        try {
          await ctx.telegram.deleteMessage(channelId, messageId);
        } catch (deleteMessageError) {
          console.error({ deleteMessageError });
        }
      }
    }
  }

  protected replyWrapper<T>(
    replyType: core.Reply["type"],
    replyPromise: Promise<T>
  ): Promise<T | undefined> {
    const wrappedPromise = replyPromise
      .then((value) => {
        if (replyType === "system") {
          this.replyCountSystem++;
        } else {
          this.replyCountNonSystem++;
        }
        return value;
      })
      .catch<undefined>(async (replyError) => {
        this.onError(replyError, { replyType });
      });
    this.replyPromises.push(wrappedPromise);
    return wrappedPromise;
  }

  protected async startSystemMessageTimer(messageId: number, text: string) {
    const startedAt = Date.now();
    this.replySystemInProgressMessageId = messageId;
    const loopPromise = new Promise<void>(async (resolve) => {
      while (this.replySystemInProgressMessageId === messageId) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const elapsedInSeconds = Math.floor((Date.now() - startedAt) / 1000);
        if (elapsedInSeconds < 3) {
          continue;
        }
        if (elapsedInSeconds > 60) {
          // this looks like a bug
          break;
        }
        try {
          await bot.telegram.editMessageText(
            this.channelId,
            messageId,
            undefined,
            `${text} ${elapsedInSeconds}s`
          );
        } catch (editError) {
          console.error({ messageId, editError });
        }
      }
      resolve();
    });

    this.replyPromises.push(loopPromise);
  }

  protected stopSystemMessageTimer() {
    this.replySystemInProgressMessageId = undefined;
  }

  async unmaskFileUrl(markedUrl: string) {
    const fileId = extractFileIdFromMaskedUrl(this.channelId, markedUrl);
    if (typeof fileId === "string") {
      const fileLink = await bot.telegram.getFileLink(fileId);
      return fileLink.toString();
    }
  }
}

export class ChatText
  extends Chat<Update.MessageUpdate<Message.TextMessage>>
  implements core.ChatText
{
  async getTextMessage() {
    return this.ctx.message.text;
  }
}

export class ChatPhoto
  extends Chat<Update.MessageUpdate<Message.PhotoMessage>>
  implements core.ChatPhoto
{
  getPhotoCaption() {
    return this.ctx.message.caption;
  }

  getPhotoUrl() {
    const { photo } = this.ctx.message;
    return buildMaskedUrlForFile(
      this.getChannelId(),
      photo[photo.length - 1].file_id
    );
  }
}

export class ChatVoice
  extends Chat<Update.MessageUpdate<Message.VoiceMessage>>
  implements core.ChatText
{
  constructor(
    protected ctx: Context<Update.MessageUpdate<Message.VoiceMessage>>,
    protected user: User,
    protected speech: Speech
  ) {
    super(ctx, user);
  }

  async getTextMessage() {
    const { ctx } = this;
    const { file_id } = ctx.message.voice;
    this.reply({ type: "system", system: "🚨 Transcribing..." });

    const url = await bot.telegram.getFileLink(file_id);
    const response = await fetch(url);
    return this.speech.toText(response);
  }

  protected async replyInternal(reply: core.Reply) {
    if (reply.type !== "markdown") {
      return super.replyInternal(reply);
    }

    this.reply({ type: "system", system: "🚨 Synthesizing..." });
    const caption = reply.markdown;
    const speechData = await this.speech.fromText(caption);
    const blob = await speechData.blob();
    const buffer = await blob.arrayBuffer();
    const source = Buffer.from(buffer);
    await this.replyWrapper(
      reply.type,
      this.ctx.replyWithVoice(
        {
          filename: basename(speechData.url),
          source,
        },
        { caption }
      )
    );
  }
}
