import { EventBridgeEvent, Handler } from "aws-lambda";
import { Config } from "sst/node/config";

import {
  HandleTelegramWebhookInput,
  handleTelegramWebhook,
  kv,
} from "@bubby/core/3rdparty";
import { replyTextChat } from "@bubby/core/handlers";

export const handler: Handler<
  EventBridgeEvent<"telegram.webhook", HandleTelegramWebhookInput["body"]>
> = async (event) => {
  const secretToken = Config.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (event.source !== secretToken) {
    console.error("event.source !== secretToken", { event });
    return;
  }

  console.log(JSON.stringify(event.detail, null, 2));
  handleTelegramWebhook({
    body: event.detail,
    onText: (chat) => replyTextChat({ chat, kv }),
  });
};
