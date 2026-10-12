import { defaultTelegramAuth } from "eve/channels/telegram";
import { byPrincipal, type ScheduleScopeContext, type SchedulePrincipalReference } from "eve/experimental/schedules";
import { z } from "zod";
import { canChat } from "./telegram-access.ts";

export const reminderInput = z.object({
  task: z.string().trim().min(1).max(8000).describe("The reminder or task to perform when this schedule fires."),
}).strict();

const destination = z.object({
  chatId: z.string().regex(/^-?\d+$/),
  chatType: z.enum(["private", "group", "supergroup"]),
  userId: z.string().regex(/^\d+$/),
  messageThreadId: z.number().int().positive().safe().optional(),
}).strict();

export const reminderPayload = reminderInput.extend({ destination }).strict();
type ReminderPayload = z.infer<typeof reminderPayload>;
type AccessEnvironment = { TELEGRAM_ADMIN_IDS?: string; TELEGRAM_ALLOWED_CHAT_IDS?: string };

function destinationAuth(target: ReminderPayload["destination"], env: AccessEnvironment) {
  if (target.chatType === "private" && target.chatId !== target.userId) return null;
  const message = {
    chat: { id: target.chatId, type: target.chatType },
    from: { id: target.userId, isBot: false },
    messageId: "scheduled-reminder",
    messageThreadId: target.messageThreadId,
  };
  return canChat(message, env) ? defaultTelegramAuth(message) : null;
}

/** Resolve the destination exclusively from Telegram's authenticated inbound attributes. */
export function prepareReminder(
  input: z.infer<typeof reminderInput>, context: ScheduleScopeContext,
  env: AccessEnvironment = process.env,
): ReminderPayload {
  const principal = context.session.auth.current;
  if (context.channel.kind !== "channel:telegram" || principal?.principalType !== "user") {
    throw new Error("Reminders require an approved Telegram conversation.");
  }
  const attributes = principal.attributes;
  const parsed = destination.safeParse({
    chatId: attributes.chat_id, chatType: attributes.chat_type, userId: attributes.user_id,
    ...(attributes.message_thread_id === undefined ? {} : { messageThreadId: Number(attributes.message_thread_id) }),
  });
  if (!parsed.success) throw new Error("The Telegram reminder destination is invalid.");
  const expected = destinationAuth(parsed.data, env);
  if (!expected || principal.authenticator !== expected.authenticator
    || principal.issuer !== expected.issuer || principal.principalId !== expected.principalId) {
    throw new Error("This Telegram user or chat is not allowed to schedule reminders.");
  }
  return reminderPayload.parse({ ...reminderInput.parse(input), destination: parsed.data });
}

export function reminderScope(context: ScheduleScopeContext, env: AccessEnvironment = process.env) {
  try {
    prepareReminder({ task: "Check access" }, context, env);
    return byPrincipal(context);
  } catch {
    return null;
  }
}

/** Recheck current access on every occurrence rather than retaining old permissions. */
export function reminderAuth(
  { principal, payload }: { principal: SchedulePrincipalReference; payload: ReminderPayload },
  env: AccessEnvironment = process.env,
) {
  const parsed = reminderPayload.safeParse(payload);
  if (!parsed.success) return null;
  const auth = destinationAuth(parsed.data.destination, env);
  if (!auth || principal.type !== auth.principalType || principal.authenticator !== auth.authenticator
    || principal.issuer !== auth.issuer || principal.principalId !== auth.principalId) return null;
  return auth;
}
