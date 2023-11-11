import { EventBridgeEvent, Handler } from "aws-lambda";
import type { Update } from "telegraf/src/core/types/typegram";
import { Config } from "sst/node/config";

export const handler: Handler<
  EventBridgeEvent<"telegram.webhook", Update>
> = async (event) => {
  const secretToken = Config.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (event.source !== secretToken) {
    console.error("event.source !== secretToken", { event });
    return;
  }

  console.log("Incoming Telegram webhook", { event });
};
