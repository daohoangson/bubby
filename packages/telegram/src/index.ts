import { Config } from "sst/node/config";

import { bot } from "./internal/telegram";
import { commands } from "./internal/commands";

export * from "./on_message";

export async function setupTelegram({ webhookUrl }: { webhookUrl: string }) {
  if (Config.STAGE !== "prod") {
    await bot.telegram.setMyCommands(
      commands.map(({ command, description }) => ({ command, description }))
    );
  }

  return bot.telegram.setWebhook(webhookUrl, {
    secret_token: Config.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  });
}
