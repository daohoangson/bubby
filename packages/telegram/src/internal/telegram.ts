import { Config } from "sst/node/config";
import { Telegraf } from "telegraf";

export const bot = new Telegraf(Config.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: parseInt(Config.TELEGRAM_WEBHOOK_TIMEOUT, 10) * 1000,
});
