import { checkTelegramSettings } from "../lib/telegram-settings.ts";

try {
  console.log((await checkTelegramSettings(process.env)).join("\n"));
} catch (error) {
  const message = error instanceof Error ? error.message : "Bot settings check failed";
  console.error(process.env.TELEGRAM_BOT_TOKEN ? message.replaceAll(process.env.TELEGRAM_BOT_TOKEN, "[REDACTED]") : message);
  process.exitCode = 1;
}
