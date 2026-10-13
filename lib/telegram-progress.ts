import type { TelegramChannelState, TelegramHandle } from "eve/channels/telegram";

export type ProgressChannel = {
  state: TelegramChannelState & { progressMessage?: { id: string; text: string; updatedAt: number } };
  telegram: Pick<TelegramHandle, "post" | "editMessageText" | "request" | "chatId">;
};

export async function showTelegramProgress(channel: ProgressChannel, text: string, now = Date.now()) {
  try {
    const previous = channel.state.progressMessage;
    if (previous?.text === text) return;
    if (previous) {
      if (now - previous.updatedAt < 2_000) return;
      const response = await channel.telegram.editMessageText({ messageId: previous.id, text });
      if (response.ok) channel.state.progressMessage = { id: previous.id, text, updatedAt: now };
    } else {
      const message = await channel.telegram.post({ text, disable_notification: true });
      if (message.id) channel.state.progressMessage = { id: message.id, text, updatedAt: now };
    }
  } catch {
    // Status delivery must not interrupt the user's task.
  }
}

export async function clearTelegramProgress(channel: ProgressChannel) {
  const previous = channel.state.progressMessage;
  if (!previous) return;
  try {
    const response = await channel.telegram.request("deleteMessage", {
      chat_id: channel.telegram.chatId, message_id: previous.id,
    });
    if (response.ok) delete channel.state.progressMessage;
  } catch {
    // Retain the ID so a later terminal event can retry cleanup.
  }
}

export function telegramToolStatus(actions: readonly {
  kind: string; toolName?: string; input?: { command?: string };
}[]): string | null {
  const calls = actions.filter(action => action.kind === "tool-call");
  if (calls.some(action => /(?:^|[.:/])publish_file$/.test(action.toolName ?? ""))) return "Sending your file...";
  if (calls.some(action => /\bnpm\s+(?:install|i|add|ci)\b/.test(action.input?.command ?? ""))) return "Installing dependencies...";
  if (calls.some(action => /(?:^|[.:/])bash$/.test(action.toolName ?? ""))) return "Running code...";
  if (calls.some(action => /(?:^|[.:/])write_file$/.test(action.toolName ?? ""))) return "Creating your file...";
  if (calls.some(action => /(?:^|[.:/])(?:read_file|glob)$/.test(action.toolName ?? ""))) return "Reading files...";
  return null;
}
