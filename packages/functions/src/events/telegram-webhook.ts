import { Handler, SQSEvent, SQSRecord } from "aws-lambda";
import { Config } from "sst/node/config";

import { handleTelegramWebhook, kv } from "@bubby/core/3rdparty";
import { replyTextChat } from "@bubby/core/handlers";

export const handler: Handler<SQSEvent> = async ({ Records }) => {
  for (const record of Records) {
    await recordHandler(record);
  }
};

async function recordHandler(record: SQSRecord) {
  const expectedSecretToken = Config.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  const actualSecretToken =
    record.messageAttributes["XTelegramBotApiSecretToken"];
  if (
    typeof actualSecretToken !== "object" ||
    actualSecretToken.stringValue !== expectedSecretToken
  ) {
    console.warn("Unrecognized secret token", {
      record: JSON.stringify(actualSecretToken),
    });
    return;
  }

  const body = JSON.parse(record.body);
  console.log(JSON.stringify(body, null, 2));
  await handleTelegramWebhook({
    body,
    onText: (chat) => replyTextChat({ chat, kv }),
  });
}
