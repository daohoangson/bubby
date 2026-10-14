import type { SessionAuthContext } from "eve/context";
import type { SchedulePrincipalReference, ScheduleScopeContext } from "eve/experimental/schedules";
import { z } from "zod";
import { includesId } from "./telegram-access.ts";
import { zaloApi } from "./zalo-api.ts";

const destinationSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("telegram"), chatId: z.string().regex(/^-?\d+$/),
    chatType: z.enum(["private", "group", "supergroup"]), userId: z.string().regex(/^\d+$/),
    messageThreadId: z.number().int().positive().optional() }),
  z.object({ channel: z.literal("zalo"), chatId: z.string().min(1),
    chatType: z.enum(["PRIVATE", "GROUP"]), userId: z.string().min(1) }),
]);
export const reminderInputSchema = z.object({
  text: z.string().trim().min(1).max(1800).describe("Exact reminder text to send when due, in the user's language. No code or agent task is executed."),
});
export const reminderPayloadSchema = reminderInputSchema.extend({ destination: destinationSchema });
export type ReminderPayload = z.infer<typeof reminderPayloadSchema>;
type Destination = ReminderPayload["destination"];
type ReminderEnv = {
  TELEGRAM_ALLOWED_USER_IDS?: string; TELEGRAM_ALLOWED_CHAT_IDS?: string; TELEGRAM_BOT_TOKEN?: string;
  ZALO_ALLOWED_USER_IDS?: string; ZALO_ALLOWED_CHAT_IDS?: string; ZALO_BOT_TOKEN?: string;
};

function destinationAuth(destination: Destination): SessionAuthContext {
  const telegram = destination.channel === "telegram";
  const channel = destination.channel;
  const group = telegram ? destination.chatType !== "private" : destination.chatType === "GROUP";
  return {
    authenticator: `${channel}-webhook`, principalType: "user",
    issuer: group ? `${channel}:${destination.chatId}` : channel,
    principalId: group ? `${channel}:${destination.chatId}:${destination.userId}` : `${channel}:${destination.userId}`,
    attributes: { chat_id: destination.chatId, chat_type: destination.chatType, user_id: destination.userId,
      ...(telegram && destination.messageThreadId !== undefined
        ? { message_thread_id: String(destination.messageThreadId) } : {}) },
  };
}

function allowed(destination: Destination, env: ReminderEnv): boolean {
  if (destination.channel === "telegram") {
    return destination.chatType === "private"
      ? destination.chatId === destination.userId && includesId(env.TELEGRAM_ALLOWED_USER_IDS, destination.userId)
      : includesId(env.TELEGRAM_ALLOWED_CHAT_IDS, destination.chatId);
  }
  return destination.chatType === "PRIVATE"
    ? includesId(env.ZALO_ALLOWED_USER_IDS, destination.userId)
    : includesId(env.ZALO_ALLOWED_CHAT_IDS, destination.chatId);
}

/** Capture only verified webhook attributes, never model-supplied chat IDs. */
export function captureReminderDestination(context: ScheduleScopeContext, env: ReminderEnv = process.env): Destination {
  const auth = context.session.auth.current;
  if (!auth || auth.principalType !== "user" || context.session.schedule) {
    throw new Error("Reminders require an allowed user's Telegram or Zalo conversation.");
  }
  const channel = auth.authenticator === "telegram-webhook" ? "telegram"
    : auth.authenticator === "zalo-webhook" ? "zalo" : null;
  if (!channel || context.channel.kind !== `channel:${channel}`) {
    throw new Error("Create and manage reminders from Telegram or Zalo.");
  }
  const attrs = auth.attributes;
  const destination = destinationSchema.parse({ channel, chatId: attrs.chat_id,
    chatType: attrs.chat_type, userId: attrs.user_id,
    ...(channel === "telegram" && attrs.message_thread_id !== undefined
      ? { messageThreadId: Number(attrs.message_thread_id) } : {}) });
  const expected = destinationAuth(destination);
  if (auth.principalId !== expected.principalId || auth.issuer !== expected.issuer || !allowed(destination, env)) {
    throw new Error("This user or chat is no longer allowed to use reminders.");
  }
  return destination;
}

/** Re-resolve the creator against today's allowlists before every occurrence. */
export function resolveReminderAuth(principal: SchedulePrincipalReference, payload: ReminderPayload,
  env: ReminderEnv = process.env): SessionAuthContext | null {
  const parsed = reminderPayloadSchema.safeParse(payload);
  if (!parsed.success || !allowed(parsed.data.destination, env)) return null;
  const auth = destinationAuth(parsed.data.destination);
  return principal.type === auth.principalType && principal.authenticator === auth.authenticator
    && principal.principalId === auth.principalId && principal.issuer === auth.issuer && principal.subject === undefined
    ? auth : null;
}

/** Deliver saved text directly; provider retries can repeat a message. */
export async function deliverReminder(payload: ReminderPayload, env: ReminderEnv = process.env,
  request: typeof fetch = fetch): Promise<void> {
  const { destination, text } = reminderPayloadSchema.parse(payload);
  if (!allowed(destination, env)) throw new Error("Reminder destination is no longer allowed.");
  if (destination.channel === "zalo") {
    await zaloApi("sendMessage", { chat_id: destination.chatId, text }, env, request);
    return;
  }
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram reminders require TELEGRAM_BOT_TOKEN.");
  let response: Response;
  try {
    response = await request(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: destination.chatId, text, message_thread_id: destination.messageThreadId }),
      signal: AbortSignal.timeout(35_000),
    });
  } catch { throw new Error("Telegram reminder request failed."); }
  if (!response.ok) throw new Error(`Telegram reminder failed: HTTP ${response.status}`);
  const result = z.object({ ok: z.literal(true) }).safeParse(await response.json().catch(() => null));
  if (!result.success) throw new Error("Telegram did not confirm reminder delivery.");
}
