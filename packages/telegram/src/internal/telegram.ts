import { Config } from "sst/node/config";
import { Telegraf } from "telegraf";

export const bot = new Telegraf(Config.TELEGRAM_BOT_TOKEN);
