import { defineDynamicSchedules } from "eve/experimental/schedules";
import { never } from "eve/tools/approval";
import telegram from "../channels/telegram.ts";
import { prepareReminder, reminderAuth, reminderInput, reminderScope } from "../../lib/telegram-reminders.ts";

export default defineDynamicSchedules({
  description: "Manage personal reminders and recurring tasks. Deliver to the Telegram chat/topic where created.",
  inputSchema: reminderInput,
  scope: reminderScope,
  preparePayload: prepareReminder,
  auth: reminderAuth,
  approval: {
    create: never(), update: never(), enable: never(), disable: never(), invoke: never(), delete: never(),
  },
  run({ payload, to, waitUntil }) {
    const { chatId, messageThreadId } = payload.destination;
    waitUntil(to(telegram, { chatId, messageThreadId }).send(
      `This is a scheduled task. It is due now. Deliver the reminder or carry out the requested task concisely.\n\n${payload.task}`,
    ));
  },
});
