export function includesId(list: string | undefined, id: string): boolean {
  return (list || "").split(",").map((value) => value.trim()).filter(Boolean).includes(id);
}

export function canChat(
  message: { chat: { id: string; type: string }; from?: { id: string; isBot: boolean } },
  env: { TELEGRAM_ADMIN_IDS?: string; TELEGRAM_ALLOWED_CHAT_IDS?: string },
): boolean {
  if (!message.from || message.from.isBot) return false;
  if (message.chat.type === "private") return includesId(env.TELEGRAM_ADMIN_IDS, message.from.id);
  if (message.chat.type === "group" || message.chat.type === "supergroup") {
    return includesId(env.TELEGRAM_ALLOWED_CHAT_IDS, message.chat.id);
  }
  return false;
}
