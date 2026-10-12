import { z } from "zod";

// The text-only agent has no slash commands. Replace the legacy default menu.
export async function syncTelegramCommands(token: string | undefined, request: typeof fetch = fetch): Promise<void> {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required in .env.local");
  const resultSchema = z.object({ ok: z.literal(true), result: z.literal(true) });
  let response: Response;
  try {
    response = await request(`https://api.telegram.org/bot${token}/deleteMyCommands`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: { type: "default" }, language_code: "" }),
    });
  } catch {
    throw new Error("Telegram command menu sync failed; check network access");
  }
  if (!response.ok || !resultSchema.safeParse(await response.json()).success) {
    throw new Error(`Telegram command menu sync failed: HTTP ${response.status}`);
  }
}
