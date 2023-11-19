import { Config } from "sst/node/config";

import { bot } from "./internal/telegram";

export * from "./on_message";

export async function setupTelegram({ webhookUrl }: { webhookUrl: string }) {
  return bot.telegram.setWebhook(webhookUrl, {
    secret_token: Config.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  });
}
