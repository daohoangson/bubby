import { z } from "zod";

const botResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    id: z.number().int(),
    is_bot: z.literal(true),
    username: z.string(),
    can_join_groups: z.boolean().optional(),
    can_read_all_group_messages: z.boolean().optional(),
    has_topics_enabled: z.boolean().optional(),
    allows_users_to_create_topics: z.boolean().optional(),
  }),
});

type SettingsEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_ADMIN_IDS?: string;
  TELEGRAM_ALLOWED_CHAT_IDS?: string;
};

export async function checkTelegramSettings(env: SettingsEnv, request: typeof fetch = fetch): Promise<string[]> {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required in .env.local");
  let response: Response;
  try {
    response = await request(`https://api.telegram.org/bot${token}/getMe`, { method: "POST" });
  } catch {
    throw new Error("Telegram getMe request failed; check network access");
  }
  if (!response.ok) throw new Error(`Telegram getMe failed: HTTP ${response.status}`);
  const parsed = botResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Telegram getMe returned an invalid bot response");
  const bot = parsed.data.result;
  const expectedUsername = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (expectedUsername && expectedUsername.toLowerCase() !== bot.username.toLowerCase()) {
    throw new Error(`Bot token belongs to @${bot.username}, but TELEGRAM_BOT_USERNAME is @${expectedUsername}. Fix .env.local before registering the webhook.`);
  }

  const lines = [`Bot: @${bot.username} (${bot.id})`];
  lines.push(bot.has_topics_enabled === true
    ? "OK: Private-chat Threaded Mode is enabled."
    : "SETUP: In @BotFather's Mini App, select this bot > Bot Settings > Threads Settings > enable Threaded Mode.");
  if (bot.has_topics_enabled === true) {
    lines.push(bot.allows_users_to_create_topics === true
      ? "OK: Users can create private-chat threads."
      : "SETUP: In BotFather's Threads Settings, turn off 'Disallow users to create new threads'.");
  }
  lines.push(bot.can_join_groups === true
    ? "OK: Bot can join groups."
    : "SETUP: In @BotFather, enable 'Allow Groups?' for this bot.");
  lines.push(bot.can_read_all_group_messages === true
    ? "OK: Group Privacy is disabled; ordinary group messages can reach the bot."
    : "SETUP: In @BotFather, /setprivacy > select this bot > Disable. Remove and re-add existing group memberships afterward. Privacy-enabled bots can still receive ordinary messages in groups where they are admins.");
  lines.push(hasIds(env.TELEGRAM_ADMIN_IDS)
    ? "OK: Private-chat user allowlist is configured."
    : "SETUP: Set TELEGRAM_ADMIN_IDS to your Telegram user ID; private messages are otherwise ignored.");
  lines.push(hasIds(env.TELEGRAM_ALLOWED_CHAT_IDS)
    ? "INFO: Group allowlist is configured. Enable Topics in each group for shared topic context; conversion can change its chat ID, so update TELEGRAM_ALLOWED_CHAT_IDS."
    : "INFO: Group access is disabled. Set TELEGRAM_ALLOWED_CHAT_IDS to approved group IDs to enable it.");
  return lines;
}

function hasIds(value: string | undefined): boolean {
  return (value || "").split(",").some((id) => id.trim().length > 0);
}
