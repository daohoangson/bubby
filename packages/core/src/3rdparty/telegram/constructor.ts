import { serializeError } from "serialize-error";
import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Chat, Reply } from "../../abstracts/chat";
import { extractFileIdFromMaskedUrl } from "../../abstracts/masked_url";
import { User } from "../../abstracts/user";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";
import { TELEGRAM_ADMIN_IDS } from "../../config";

export function newChatAndUser(ctx: Context<Update.MessageUpdate>) {
  const channelId = `${ctx.chat.id}`;

  let errors: any[] = [];
  const onError = (error: any, info: object = {}) => {
    errors.push(error);
    console.error({ ...info, error });
  };

  let replyCountNonSystem = 0;
  let replyCountSystem = 0;
  const replyPromises: Promise<any>[] = [];
  const replySystemMessageIds: number[] = [];

  const tryTo = <T>(
    replyType: Reply["type"],
    replyPromise: Promise<T>
  ): Promise<T | undefined> => {
    const wrappedPromise = replyPromise
      .then((value) => {
        if (replyType === "system") {
          replyCountSystem++;
        } else {
          replyCountNonSystem++;
        }
        return value;
      })
      .catch<undefined>(async (replyError) => {
        onError(replyError, { replyType });
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
          if (typeof newMessage !== "undefined") {
            replySystemMessageIds.push(newMessage.message_id);
          }
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
    onError,
    sendFinalReply: async () => {
      await Promise.all(replyPromises);

      if (replyCountNonSystem === 0 && errors.length > 0) {
        const somethingWentWrong =
          "🚨 Something went wrong, please try again later.";
        let informedAdmin = false;

        if (errors.length > 0 && user.isAdmin()) {
          try {
            const json = JSON.stringify(errors.map((e) => serializeError(e)));
            await ctx.replyWithDocument(
              { source: Buffer.from(json), filename: "errors.json" },
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

      if (replyCountNonSystem > 0) {
        for (const messageId of replySystemMessageIds) {
          try {
            await ctx.telegram.deleteMessage(channelId, messageId);
          } catch (deleteMessageError) {
            console.error({ deleteMessageError });
          }
        }
      }
    },
  } satisfies Chat & Record<string, any>;

  const user = {
    getUserId: () => `${ctx.from.id}`,
    getUserName: () => `${ctx.from.first_name} ${ctx.from.last_name}`,
    isAdmin: () => TELEGRAM_ADMIN_IDS.includes(ctx.from.id),
  } satisfies User;

  return { chat, user };
}
