import { defaultTelegramAuth, telegramChannel } from "eve/channels/telegram";
import { canChat } from "../../lib/telegram-access.ts";
import { withTopicConversations } from "../../lib/telegram-topics.ts";

export default withTopicConversations(telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  uploadPolicy: { allowedMediaTypes: ["image/*"] },
  async onMessage(ctx, message) {
    const hasImage = message.attachments.some((attachment) =>
      attachment.kind === "photo" || attachment.mediaType?.startsWith("image/"));
    if (!canChat(message, process.env) || (!message.text.trim() && !hasImage)) return null;
    await ctx.telegram.startTyping();
    return { auth: defaultTelegramAuth(message) };
  },
}));
