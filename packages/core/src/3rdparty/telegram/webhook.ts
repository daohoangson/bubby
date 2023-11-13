import { Context } from "telegraf";
import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import { Chat, ChatPhoto, ChatText } from "../../abstracts/chat";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";
import {
  buildMaskedUrlForFile,
  extractFileIdFromMaskedUrl,
} from "../../abstracts/masked_url";

type ChatInternal = Chat & {
  replyLastError: () => Promise<void>;
};

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
    await handlerInternal(
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
    await handlerInternal(
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

async function handlerInternal(
  chat: ChatInternal,
  promise: Promise<void>
): Promise<void> {
  try {
    await promise;
    await chat.replyLastError();
  } catch (error) {
    console.warn(error);
  }
}

function newChat(ctx: Context<Update.MessageUpdate>): ChatInternal {
  const channelId = `${ctx.chat.id}`;

  let repliedSomething = false;
  let hasError = false;
  const errors: Error[] = [];
  const tryTo = (p: Promise<any>) =>
    p.then(
      () => (repliedSomething = true),
      (error) => {
        hasError = true;
        if (error instanceof Error) {
          errors.push(error);
        }
        console.warn(error);
      }
    );

  return {
    getChannelId: () => channelId,
    getUserId: () => `${ctx.from.id}`,
    reply: async (reply) => {
      console.log({ chatId: ctx.chat.id, reply });
      switch (reply.type) {
        case "markdown":
          const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
          await tryTo(ctx.replyWithHTML(safeHtml));
          break;
        case "photo":
          const { caption, url } = reply;
          await tryTo(ctx.replyWithPhoto({ url }, { caption }));
          break;
        case "system":
          await tryTo(
            ctx.reply(reply.system, {
              disable_notification: true,
            })
          );
          break;
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
    replyLastError: async () => {
      if (!repliedSomething && hasError) {
        if (errors.length > 0) {
          await ctx.reply(`🚨 ${errors[errors.length - 1].message}`);
        } else {
          await ctx.reply("🚨 Something went wrong, please try again later.");
        }
      }
    },
  };
}
