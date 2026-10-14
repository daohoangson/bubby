import { byPrincipal, defineDynamicSchedules } from "eve/experimental/schedules";
import { never } from "eve/tools/approval";
import { devScheduleProvider } from "../../lib/dev-schedules.ts";
import { captureReminderDestination, deliverReminder, reminderInputSchema, resolveReminderAuth } from "../../lib/reminders.ts";

export default defineDynamicSchedules({
  description: "Create and manage personal text reminders in this Telegram or Zalo chat. Supports delays, one-time dates and recurring cron schedules. Default timezone: Asia/Ho_Chi_Minh. Payload text is sent directly when due; it does not execute an agent task. Use the returned unique name for updates or cancellation.",
  inputSchema: reminderInputSchema,
  provider: process.env.EVE_DEV === "1" ? devScheduleProvider() : undefined,
  // The user's chat request authorizes this bounded action. Zalo has no approval UI.
  approval: { create: never(), update: never(), enable: never(), disable: never(), invoke: never(), delete: never() },
  scope(context) {
    try { captureReminderDestination(context); }
    catch { return null; }
    return byPrincipal(context);
  },
  preparePayload(input, context) {
    return { ...input, destination: captureReminderDestination(context) };
  },
  auth({ principal, payload }) { return resolveReminderAuth(principal, payload); },
  async run({ payload }) { await deliverReminder(payload); },
});
