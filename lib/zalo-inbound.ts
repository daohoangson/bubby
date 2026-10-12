import { timingSafeEqual } from "node:crypto";
import type { UserContent } from "ai";
import { z } from "zod";

export const zaloMessageSchema = z.object({
  from: z.object({ id: z.string().min(1), is_bot: z.boolean() }),
  chat: z.object({ id: z.string().min(1), chat_type: z.enum(["PRIVATE", "GROUP"]) }),
  message_id: z.string().min(1),
  text: z.string().optional(),
  photo: z.url({ protocol: /^https$/ }).optional(),
  caption: z.string().optional(),
});
const zaloEventSchema = z.object({ event_name: z.string(), message: zaloMessageSchema.optional() });
// Live webhooks send the event directly; polling and the documented webhook
// example wrap it in the API response envelope.
export const zaloUpdateSchema = z.union([
  zaloEventSchema,
  z.object({ ok: z.literal(true), result: zaloEventSchema }).transform(({ result }) => result),
]);
export type ZaloMessage = z.infer<typeof zaloMessageSchema>;
export type ZaloAccessEnv = { ZALO_ALLOWED_USER_IDS?: string; ZALO_ALLOWED_CHAT_IDS?: string };

export function verifyZaloWebhook(request: Request, secret?: string): boolean {
  if (!secret || secret.length < 8 || secret.length > 256) return false;
  const received = Buffer.from(request.headers.get("x-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function canChatOnZalo(message: ZaloMessage, env: ZaloAccessEnv = process.env): boolean {
  if (message.from.is_bot) return false;
  const includes = (list: string | undefined, id: string) =>
    (list ?? "").split(",").some((entry) => entry.trim() === id);
  return message.chat.chat_type === "PRIVATE"
    ? includes(env.ZALO_ALLOWED_USER_IDS, message.from.id)
    : includes(env.ZALO_ALLOWED_CHAT_IDS, message.chat.id);
}

export function zaloContent(event: string, message: ZaloMessage): UserContent | null {
  if (event === "message.text.received") {
    return message.text?.trim() ? [{ type: "text", text: message.text }] : null;
  }
  if (event === "message.image.received" && message.photo) {
    return [
      { type: "text", text: message.caption?.trim() || "Describe this image briefly and ask what I need help with." },
      { type: "image", image: new URL(message.photo) },
    ];
  }
  return null;
}

export function zaloAuth(message: ZaloMessage) {
  const group = message.chat.chat_type === "GROUP";
  return {
    authenticator: "zalo-webhook", issuer: group ? `zalo:${message.chat.id}` : "zalo",
    principalId: group ? `zalo:${message.chat.id}:${message.from.id}` : `zalo:${message.from.id}`,
    principalType: "user" as const,
    attributes: { user_id: message.from.id, chat_id: message.chat.id, chat_type: message.chat.chat_type },
  };
}
