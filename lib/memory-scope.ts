import type { MemoryScopeContext } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { canChat } from "./telegram-access.ts";

/** Share personal memory across an allowed user's private Telegram topics. */
export function telegramMemoryScope(
  context: MemoryScopeContext,
  env: { TELEGRAM_ADMIN_IDS?: string; TELEGRAM_ALLOWED_CHAT_IDS?: string } = process.env,
): string | null {
  const principal = context.session.auth.current;
  if (context.channel.kind !== "channel:telegram"
    || principal?.principalType !== "user"
    || principal.authenticator !== "telegram-webhook"
    || principal.issuer !== "telegram"
    || principal.attributes.chat_type !== "private") return null;

  const userId = principal.attributes.user_id;
  const chatId = principal.attributes.chat_id;
  if (typeof userId !== "string" || typeof chatId !== "string"
    || chatId !== userId || principal.principalId !== `telegram:${userId}`) return null;

  if (!canChat({ chat: { id: chatId, type: "private" }, from: { id: userId, isBot: false } }, env)) {
    return null;
  }
  return byPrincipal(context);
}
