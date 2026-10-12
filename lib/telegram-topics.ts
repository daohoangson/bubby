import type { TelegramChannel } from "eve/channels/telegram";
import { z } from "zod";

const forumMessageSchema = z.object({
  chat: z.object({ id: z.number().int().safe(), type: z.string(), is_forum: z.boolean().optional() }),
  message_thread_id: z.number().int().positive().optional(),
});
const forumUpdateSchema = z.object({
  message: forumMessageSchema.optional(),
  callback_query: z.object({ message: forumMessageSchema.optional() }).optional(),
});

// Keep Eve's Telegram transport and verification; change only forum routing.
export function withTopicConversations(channel: TelegramChannel): TelegramChannel {
  return {
    ...channel,
    routes: channel.routes.map((route) => {
      if (route.transport === "websocket") return route;
      return {
        ...route,
        async handler(request, args) {
          const parsed = forumUpdateSchema.safeParse(await request.clone().json().catch(() => null));
          const address = parsed.success ? forumConversationAddress(parsed.data) : undefined;
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

function forumConversationAddress(update: z.infer<typeof forumUpdateSchema>): string | undefined {
  const message = update.message ?? update.callback_query?.message;
  if (!message) return;
  const chat = message.chat;
  if (chat.type !== "supergroup" || chat.is_forum !== true) return;
  const topic = message.message_thread_id;
  // Telegram omits message_thread_id for General; 1 is its topic ID.
  return `forum:${chat.id}:${topic ?? 1}`;
}
