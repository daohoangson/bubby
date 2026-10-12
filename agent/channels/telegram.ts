import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";
import { canChat } from "../../lib/telegram-access.ts";
import { withTopicConversations } from "../../lib/telegram-topics.ts";

export default withTopicConversations(telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  uploadPolicy: { maxBytes: 20_000_000, allowedMediaTypes: [
    "image/*", "application/pdf", "text/plain", "text/csv", "application/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ] },
  async onMessage(ctx, message) {
    if (!canChat(message, process.env) || (!message.text.trim() && !message.attachments.length)) return null;
    await ctx.telegram.startTyping();
    return { auth: defaultTelegramAuth(message) };
  },
}));
