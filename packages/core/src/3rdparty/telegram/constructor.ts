import { serializeError } from "serialize-error";
import { Config } from "sst/node/config";
import { Context } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram";

import { Chat, Reply } from "../../abstracts/chat";
import { extractFileIdFromMaskedUrl } from "../../abstracts/masked_url";
import { User } from "../../abstracts/user";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";

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

  let replySystemInProgressMessageId: number | undefined;
  const startSystemMessageTimer = async (messageId: number, text: string) => {
    const startedAt = Date.now();
    replySystemInProgressMessageId = messageId;
    const loopPromise = new Promise<void>(async (resolve) => {
      while (replySystemInProgressMessageId === messageId) {
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
            channelId,
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
    replyPromises.push(loopPromise);
  };
  const stopSystemMessageTimer = () =>
    (replySystemInProgressMessageId = undefined);

  const chat = {
    getChannelId: () => channelId,
    reply: async (reply) => {
      stopSystemMessageTimer();

      switch (reply.type) {
        case "markdown":
          const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
          console.log({ channelId, reply, safeHtml });
          await tryTo(reply.type, ctx.replyWithHTML(safeHtml));
          break;
        case "photo":
          console.log({ channelId, reply });
          const { caption, url } = reply;
          await tryTo(reply.type, ctx.replyWithPhoto({ url }, { caption }));
          break;
        case "system":
          console.log({ channelId, reply });
          const systemMessage = await tryTo(
            reply.type,
            ctx.reply(reply.system, { disable_notification: true })
          );
          if (typeof systemMessage !== "undefined") {
            const systemMessageId = systemMessage.message_id;
            replySystemMessageIds.push(systemMessageId);
            startSystemMessageTimer(systemMessageId, reply.system);
          }
          break;
        default:
          console.warn("Unknown reply type", { channelId, reply });
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
      stopSystemMessageTimer();
      await Promise.all(replyPromises);

      if (replyCountNonSystem === 0 && errors.length > 0) {
        const somethingWentWrong =
          "🚨 Something went wrong, please try again later.";
        let informedAdmin = false;

        if (errors.length > 0 && user.isAdmin()) {
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
    isAdmin: () =>
      Config.TELEGRAM_ADMIN_IDS.split(",")
        .map((v) => parseInt(v.trim()))
        .includes(ctx.from.id),
  } satisfies User;

  return { chat, user };
}
