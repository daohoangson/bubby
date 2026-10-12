import { defaultTelegramAuth, resolveTelegramBotToken, telegramChannel } from "eve/channels/telegram";
import { toolResultFrom } from "eve/tools";
import { canChat } from "../../lib/telegram-access.ts";
import { withTopicConversations } from "../../lib/telegram-topics.ts";
import { sendTelegramFile } from "../../lib/telegram-files.ts";
import publishFile from "../tools/publish_file.ts";

export default withTopicConversations(telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  uploadPolicy: { maxBytes: 20_000_000, allowedMediaTypes: [
    "image/*", "application/pdf", "text/plain", "text/csv", "application/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ] },
  events: {
    async "action.result"(event, channel, ctx) {
      const published = toolResultFrom(event.result, publishFile);
      if (!published) return;
      await sendTelegramFile({
        sandbox: await ctx.getSandbox(), file: published.output,
        chatId: channel.telegram.chatId, messageThreadId: channel.telegram.messageThreadId,
        token: await resolveTelegramBotToken(),
      });
    },
  },
  async onMessage(ctx, message) {
    if (!canChat(message, process.env) || (!message.text.trim() && !message.attachments.length)) return null;
    await ctx.telegram.startTyping();
    return { auth: defaultTelegramAuth(message) };
  },
}));
