import { z } from "zod";
import type { SandboxSession } from "eve/sandbox";
import { readOutputFile, type OutputFile } from "./output-files.ts";

const responseSchema = z.object({ ok: z.literal(true), result: z.object({ message_id: z.number().int() }) });

export async function sendTelegramFile(input: {
  sandbox: Pick<SandboxSession, "readFile">;
  file: OutputFile;
  chatId: string;
  messageThreadId?: number;
  token: string;
}, request: typeof fetch = fetch) {
  const { file, bytes } = await readOutputFile(input.sandbox, input.file.path);
  if (file.sha256 !== input.file.sha256 || file.size !== input.file.size) {
    throw new Error("The file changed before delivery. Publish it again.");
  }
  const body = new FormData();
  body.set("chat_id", input.chatId);
  if (input.messageThreadId !== undefined) body.set("message_thread_id", String(input.messageThreadId));
  body.set("document", new Blob([bytes], { type: file.mediaType }), file.filename);
  let response: Response;
  try {
    response = await request(`https://api.telegram.org/bot${input.token}/sendDocument`, {
      method: "POST", body, signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("Telegram file delivery failed; try again.");
  }
  if (!response.ok) throw new Error(`Telegram file delivery failed: HTTP ${response.status}`);
  const payload = await response.json().catch(() => {
    throw new Error("Telegram did not confirm file delivery.");
  });
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Telegram did not confirm file delivery.");
  return { messageId: parsed.data.result.message_id, filename: file.filename };
}
