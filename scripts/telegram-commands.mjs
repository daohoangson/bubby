import { checkTelegramSettings } from "../lib/telegram-settings.ts";
import { syncTelegramCommands } from "../lib/telegram-commands.ts";

try {
  // Verify the configured identity before modifying its menu.
  console.log((await checkTelegramSettings(process.env))[0]);
  await syncTelegramCommands(process.env.TELEGRAM_BOT_TOKEN);
  console.log("Default command menu cleared: Bubby currently has no slash commands.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Command menu sync failed";
  console.error(process.env.TELEGRAM_BOT_TOKEN ? message.replaceAll(process.env.TELEGRAM_BOT_TOKEN, "[REDACTED]") : message);
  process.exitCode = 1;
}
