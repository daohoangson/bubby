import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Chat, Reply } from "../../abstracts/chat";
import { extractFileIdFromMaskedUrl } from "../../abstracts/masked_url";
import { User } from "../../abstracts/user";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";

export function newChatAndUser(ctx: Context<Update.MessageUpdate>) {
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

  const chat = {
    getChannelId: () => channelId,
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

  const user = {
    getUserId: () => `${ctx.from.id}`,
    getUserName: () => `${ctx.from.first_name} ${ctx.from.last_name}`,

    // by default, the only admin is https://t.me/daohoangson
    isAdmin: () => ctx.from.id === 552046506,
  } satisfies User;

  return { chat, user };
}
