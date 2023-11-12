import { Update } from "telegraf/typings/core/types/typegram";

import { bot } from "./telegram";
import { ChatText, Reply } from "../../abstracts/chat";

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
    try {
      const replies = onText({
        getChannelId: () => `${ctx.chat.id}`,
        getUserId: () => `${ctx.from.id}`,
        getTextMessage: () => ctx.message.text,
      });
      for await (const reply of replies) {
        console.log({ chatId: ctx.chat.id, reply });
        await ctx.reply(reply.markdown, { parse_mode: "Markdown" });
      }
    } catch (error) {
      if (error instanceof Error) {
        await ctx.reply(error.message);
      }
    }
  });

  await bot.handleUpdate(body);
}
