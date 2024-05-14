import { basename } from "path";
import { serializeError } from "serialize-error";
import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Speech } from "@bubby/core/interfaces/ai";
import * as core from "@bubby/core/interfaces/chat";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";
import { User } from "./user";

export abstract class Chat<
  T extends Update.MessageUpdate = Update.MessageUpdate
> implements core.Chat
{
  protected channelId: string;
  protected errors: any[] = [];
  protected promises: Promise<any>[] = [];

  protected replyCountNonSystem = 0;
  protected replyCountSystem = 0;
  protected replySystemInProgress:
    | { messageId: number; text: string }
    | undefined;

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
    const { channelId, ctx, replySystemInProgress } = this;

    this.stopSystemMessageTimer();

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
        let systemMessageId = 0;
        if (typeof replySystemInProgress === "undefined") {
          const systemMessage = await this.replyWrapper(
            reply.type,
            ctx.reply(reply.system, { disable_notification: true })
          );
          systemMessageId = systemMessage?.message_id ?? 0;
        } else {
          systemMessageId = replySystemInProgress.messageId;
          await this.replyWrapper(
            reply.type,
            bot.telegram.editMessageText(
              channelId,
              systemMessageId,
              undefined,
              reply.system
            )
          );
        }
        if (systemMessageId > 0) {
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
    await Promise.all(this.promises);

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

    const { replySystemInProgress } = this;
    if (typeof replySystemInProgress === "object") {
      try {
        await ctx.telegram.deleteMessage(
          channelId,
          replySystemInProgress.messageId
        );
      } catch (deleteMessageError) {
        console.error({ deleteMessageError });
      }
    }
  }

  protected replyWrapper<T>(
    replyType: core.Reply["type"],
    fn: Promise<T> | (() => Promise<T>)
  ): Promise<T | undefined> {
    const promise = typeof fn === "function" ? fn() : fn;
    const wrappedPromise = promise
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
    this.promises.push(wrappedPromise);
    return wrappedPromise;
  }

  protected async startSystemMessageTimer(messageId: number, text: string) {
    const startedAt = Date.now();
    this.replySystemInProgress = { messageId, text };
    const loopPromise = new Promise<void>(async (resolve) => {
      while (this.replySystemInProgress?.text === text) {
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      resolve();
    });
    this.promises.push(loopPromise);
    return loopPromise;
  }

  protected stopSystemMessageTimer() {
    const { replySystemInProgress } = this;
    if (typeof replySystemInProgress === "object") {
      replySystemInProgress.text = "";
    }
  }

  async typing(): Promise<void> {
    await this.ctx.sendChatAction("typing");
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

  async getPhotoUrl() {
    const { photo } = this.ctx.message;
    const fileId = photo[photo.length - 1].file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);
    return fileLink.toString();
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

  async reply(reply: core.Reply) {
    if (reply.type !== "markdown") {
      return super.reply(reply);
    }

    const { channelId, ctx } = this;
    this.reply({ type: "system", system: "🚨 Synthesizing..." });

    await this.replyWrapper(reply.type, async () => {
      const caption = reply.markdown;
      const speechData = await this.speech.fromText(caption);
      const blob = await speechData.blob();
      const buffer = await blob.arrayBuffer();
      const source = Buffer.from(buffer);

      this.stopSystemMessageTimer();
      console.log({ channelId, reply });
      ctx.replyWithVoice(
        {
          filename: basename(speechData.url),
          source,
        },
        { caption }
      );
    });
  }
}
