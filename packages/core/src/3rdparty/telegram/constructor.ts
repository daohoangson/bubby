import { serializeError } from "serialize-error";
import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

import { Chat, Reply } from "../../abstracts/chat";
import { extractFileIdFromMaskedUrl } from "../../abstracts/masked_url";
import { User } from "../../abstracts/user";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";

export function newChatAndUser(ctx: Context<Update.MessageUpdate>) {
  const channelId = `${ctx.chat.id}`;

  let errors: any[] = [];
  let replyCountNonSystem = 0;
  let replyCountSystem = 0;
  const replyPromises: Promise<any>[] = [];

  const tryTo = <T>(
    replyType: Reply["type"],
    replyPromise: Promise<T>
  ): Promise<T | undefined> => {
    const wrappedPromise = replyPromise
      .then((message) => {
        if (replyType === "system") {
          replyCountSystem++;
        } else {
          replyCountNonSystem++;
        }
        return message;
      })
      .catch<undefined>(async (replyError) => {
        errors.push(replyError);
        console.error({ replyType, replyError });
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
