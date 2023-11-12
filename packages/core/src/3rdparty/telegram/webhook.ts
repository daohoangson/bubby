import { Update } from "telegraf/typings/core/types/typegram";

import { ChatText, Reply } from "../../abstracts/chat";
import { bot } from "./telegram";
import { convertMarkdownToSafeHtml } from "./formatting";

export type HandleTelegramWebhookInput = {
  body: Update;
  onText: (chat: ChatText) => AsyncGenerator<Reply>;
};

export async function handleTelegramWebhook({
  body,
  onText,
}: HandleTelegramWebhookInput) {
  bot.on("text", async (ctx) => {
    await ctx.sendChatAction("typing");

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

    const replies = onText({
      getChannelId: () => `${ctx.chat.id}`,
      getUserId: () => `${ctx.from.id}`,
      getTextMessage: () => ctx.message.text,
    });
    for await (const reply of replies) {
      console.log({ chatId: ctx.chat.id, reply });
      switch (reply.type) {
        case "markdown":
          const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
          await tryTo(ctx.replyWithHTML(safeHtml));
          break;
        case "photo":
          await tryTo(
            ctx.replyWithPhoto(reply.url, { caption: reply.caption })
          );
          break;
        case "plaintext":
          await tryTo(ctx.reply(reply.plaintext));
          break;
      }
    }

    if (!repliedSomething && hasError) {
      if (errors.length > 0) {
        await ctx.reply(`🚨 ${errors[errors.length - 1].message}`);
      } else {
        await ctx.reply("🚨 Something went wrong, please try again later.");
      }
    }
  });

  await bot.handleUpdate(body);
}
