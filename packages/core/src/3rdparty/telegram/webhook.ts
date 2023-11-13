import { Context } from "telegraf";
import { message } from "telegraf/filters";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Chat, ChatPhoto, ChatText, Reply } from "../../abstracts/chat";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";
import {
  buildMaskedUrlForFile,
  extractFileIdFromMaskedUrl,
} from "../../abstracts/masked_url";

export type HandleTelegramWebhookInput = {
  body: Update;
  onPhoto: (chat: ChatPhoto) => Promise<void>;
  onText: (chat: ChatText) => Promise<void>;
};

export async function handleTelegramWebhook({
  body,
  onPhoto,
  onText,
}: HandleTelegramWebhookInput) {
  bot.on(message("text"), async (ctx) => {
    const chat = newChat(ctx);
    await allReplies(
      chat,
      onText({
        ...chat,
        getTextMessage: () => ctx.message.text,
      })
    );
  });

  bot.on(message("photo"), async (ctx) => {
    const { photo } = ctx.message;
    const chat = newChat(ctx);
    await allReplies(
      chat,
      onPhoto({
        ...chat,
        getPhotoCaption: () => ctx.message.caption,
        getPhotoUrl: () =>
          buildMaskedUrlForFile(
            chat.getChannelId(),
            photo[photo.length - 1].file_id
          ),
      })
    );
  });

  await bot.handleUpdate(body);
}

async function allReplies(
  chat: ReturnType<typeof newChat>,
  handlerPromise: Promise<void>
): Promise<void> {
  await handlerPromise;
  await chat.sendFinalReply();
}

function newChat(ctx: Context<Update.MessageUpdate>) {
  const channelId = `${ctx.chat.id}`;

  let repliedSomething = false;
  const replyPromises: Promise<any>[] = [];
  let hasError = false;
  const errors: Error[] = [];
  const tryTo = <T>(
    replyType: Reply["type"],
    replyPromise: Promise<T>
  ): Promise<T | undefined> => {
    const wrappedPromise = replyPromise
      .then((message) => {
        repliedSomething = true;
        return message;
      })
      .catch<undefined>(async (replyError) => {
        hasError = true;
        if (replyError instanceof Error) {
          errors.push(replyError);
        }
        console.warn({ replyType, replyError });
      });
    replyPromises.push(wrappedPromise);
    return wrappedPromise;
  };

  return {
    getChannelId: () => channelId,
    getUserId: () => `${ctx.from.id}`,
    reply: async (reply) => {
      let newMessage: Message.ServiceMessage | undefined;
      switch (reply.type) {
        case "markdown":
          const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
          console.log({ channelId, reply, safeHtml });
          newMessage = await tryTo(reply.type, ctx.replyWithHTML(safeHtml));
          break;
        case "photo":
          console.log({ channelId, reply });
          const { caption, url } = reply;
          newMessage = await tryTo(
            reply.type,
            ctx.replyWithPhoto({ url }, { caption })
          );
          break;
        case "system":
          console.log({ channelId, reply });
          newMessage = await tryTo(
            reply.type,
            ctx.reply(reply.system, { disable_notification: true })
          );
          break;
        default:
          console.warn("Unknown reply type", { channelId, reply });
      }

      if (typeof newMessage !== "undefined") {
        const newMessageId = newMessage.message_id;
        return {
          edit: async (plainText) => {
            await bot.telegram.editMessageText(
              channelId,
              newMessageId,
              undefined,
              plainText
            );
          },
        };
      }
    },
    unmaskFileUrl: async (url) => {
      const fileId = extractFileIdFromMaskedUrl(channelId, url);
      if (typeof fileId === "string") {
        const url = await bot.telegram.getFileLink(fileId);
        return url.toString();
      }
    },

    // internal
    sendFinalReply: async () => {
      await Promise.all(replyPromises);

      if (!repliedSomething && hasError) {
        if (errors.length > 0) {
          await ctx.reply(`🚨 ${errors[errors.length - 1].message}`);
        } else {
          await ctx.reply("🚨 Something went wrong, please try again later.");
        }
      }
    },
  } satisfies Chat & Record<string, any>;
}
