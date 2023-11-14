import { Config } from "sst/node/config";

import { bot } from "../3rdparty/telegram/telegram";

export async function setupTelegram({ webhookUrl }: { webhookUrl: string }) {
  return bot.telegram.setWebhook(webhookUrl, {
    secret_token: Config.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  });
}
