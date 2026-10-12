import type { TelegramChannel } from "eve/channels/telegram";

// Keep Eve's Telegram transport and verification; change only forum routing.
export function withTopicConversations(channel: TelegramChannel): TelegramChannel {
  return {
    ...channel,
    routes: channel.routes.map((route) => {
      if (route.transport === "websocket") return route;
      return {
        ...route,
        async handler(request, args) {
          const address = forumConversationAddress(await request.clone().json().catch(() => null));
          return route.handler(request, address === undefined ? args : {
            ...args,
            from: () => args.from(address),
            resolveSession: () => args.resolveSession(address),
          });
        },
      };
    }),
  };
}

export function forumConversationAddress(update: unknown): string | undefined {
  if (!isRecord(update)) return;
  const message = update.message ?? (isRecord(update.callback_query) ? update.callback_query.message : undefined);
  if (!isRecord(message) || !isRecord(message.chat)) return;
  const chat = message.chat;
  if (chat.type !== "supergroup" || chat.is_forum !== true || !Number.isSafeInteger(chat.id)) return;
  const topic = message.message_thread_id;
  if (topic !== undefined && (typeof topic !== "number" || !Number.isSafeInteger(topic) || topic < 1)) return;
  // Telegram omits message_thread_id for General; 1 is its topic ID.
  return `forum:${chat.id}:${topic ?? 1}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
