import { defaultTelegramAuth, resolveTelegramBotToken, telegramChannel } from "eve/channels/telegram";
import { toolResultFrom } from "eve/tools";
import { canChat } from "../../lib/telegram-access.ts";
import { withTopicConversations } from "../../lib/telegram-topics.ts";
import { sendTelegramFile } from "../../lib/telegram-files.ts";
import { clearTelegramProgress, showTelegramProgress, telegramToolStatus } from "../../lib/telegram-progress.ts";
import publishFile from "../tools/publish_file.ts";

export default withTopicConversations(telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  uploadPolicy: { maxBytes: 20_000_000, allowedMediaTypes: [
    "image/*", "application/pdf", "text/plain", "text/csv", "application/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ] },
  events: {
    async "turn.started"(_event, channel) {
      await clearTelegramProgress(channel);
      await channel.telegram.startTyping();
    },
    async "actions.requested"(event, channel) {
      await channel.telegram.startTyping();
      const status = telegramToolStatus(event.actions);
      if (status) await showTelegramProgress(channel, status);
      else await clearTelegramProgress(channel);
    },
    async "message.appended"(_event, channel) { await clearTelegramProgress(channel); },
    async "action.result"(event, channel, ctx) {
      const published = toolResultFrom(event.result, publishFile);
      if (published) {
        await sendTelegramFile({
          sandbox: await ctx.getSandbox(), file: published.output,
          chatId: channel.telegram.chatId, messageThreadId: channel.telegram.messageThreadId,
          token: await resolveTelegramBotToken(),
        });
      }
    },
    async "turn.completed"(_event, channel) { await clearTelegramProgress(channel); },
    async "turn.cancelled"(_event, channel) { await clearTelegramProgress(channel); },
    async "session.waiting"(_event, channel) { await clearTelegramProgress(channel); },
    async "session.completed"(_event, channel) { await clearTelegramProgress(channel); },
    async "turn.failed"(event, channel) {
      await clearTelegramProgress(channel);
      if (!event.terminal) await channel.telegram.post("I couldn't complete your request. Please try again.");
    },
    async "session.failed"(_event, channel) {
      await clearTelegramProgress(channel);
      await channel.telegram.post("This conversation couldn't recover from an error. Please start a new topic to continue.");
    },
  },
  async onMessage(ctx, message) {
    if (message.chat.type === "private" && message.messageThreadId === undefined) return null;
    if (!canChat(message, process.env) || (!message.text.trim() && !message.attachments.length)) return null;
    await ctx.telegram.startTyping();
    return { auth: defaultTelegramAuth(message) };
  },
}));
