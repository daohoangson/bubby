import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";
import { canChat } from "../../lib/telegram-access.ts";
import { withTopicConversations } from "../../lib/telegram-topics.ts";

export default withTopicConversations(telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  async onMessage(ctx, message) {
    if (!canChat(message, process.env) || !message.text.trim()) return null;
    await ctx.telegram.startTyping();
    return { auth: defaultTelegramAuth(message) };
  },
}));
