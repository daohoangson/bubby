import { z } from "zod";

const responseSchema = z.object({ ok: z.literal(true), result: z.json().optional() });
const failureSchema = z.object({ ok: z.literal(false), error_code: z.number().int() });

export class ZaloApiError extends Error {
  readonly code: number;
  constructor(method: string, code: number) {
    super(`Zalo ${method} failed: API error ${code}`);
    this.code = code;
  }
}

/** Keep tokens and provider response bodies out of errors and logs. */
export async function zaloApi(
  method: string,
  body: Record<string, string | number>,
  env: { ZALO_BOT_TOKEN?: string } = process.env,
  request: typeof fetch = fetch,
) {
  if (!env.ZALO_BOT_TOKEN) throw new Error("Set ZALO_BOT_TOKEN in .env.local");
  if (!/^[a-zA-Z]+$/.test(method)) throw new Error("Invalid Zalo API method");
  let response: Response;
  try {
    response = await request(`https://bot-api.zaloplatforms.com/bot${env.ZALO_BOT_TOKEN}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(35_000),
    });
  } catch {
    throw new Error(`Zalo ${method} request failed`);
  }
  if (!response.ok) throw new Error(`Zalo ${method} failed: HTTP ${response.status}`);
  const payload = await response.json().catch(() => null);
  const failure = failureSchema.safeParse(payload);
  if (failure.success) throw new ZaloApiError(method, failure.data.error_code);
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error(`Zalo ${method} did not confirm success`);
  return parsed.data;
}

export async function getZaloWebhookInfo() {
  try { return await zaloApi("getWebhookInfo", {}); }
  catch (error) {
    // The live API returns error 404 for a bot without a registered webhook.
    if (error instanceof ZaloApiError && error.code === 404) return { ok: true as const, result: null };
    throw error;
  }
}

/** Count UTF-16 units conservatively, keeping surrogate pairs intact. */
export function splitZaloText(text: string): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of text) {
    if (chunk.length + character.length > 2000) { chunks.push(chunk); chunk = ""; }
    chunk += character;
  }
  if (chunk.trim()) chunks.push(chunk);
  return chunks;
}

export async function postZaloText(chatId: string, text: string) {
  for (const chunk of splitZaloText(text)) await zaloApi("sendMessage", { chat_id: chatId, text: chunk });
}

export async function showZaloTyping(chatId: string) {
  // A status API outage must not prevent an answer.
  await zaloApi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}
