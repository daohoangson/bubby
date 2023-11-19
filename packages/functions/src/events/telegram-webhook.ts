import { captureHTTPsGlobal, setContextMissingStrategy } from "aws-xray-sdk";
captureHTTPsGlobal(require("http"));
captureHTTPsGlobal(require("https"));
setContextMissingStrategy("IGNORE_ERROR");

import { Handler, SQSEvent, SQSRecord } from "aws-lambda";

import { handleTelegramWebhook } from "src/handlers/telegram-webhook-handler";

export const handler: Handler<SQSEvent> = async ({ Records }) => {
  for (const record of Records) {
    await recordHandler(record);
  }
};

async function recordHandler(record: SQSRecord) {
  let secretToken = "";
  const secretTokenAttribute =
    record.messageAttributes["XTelegramBotApiSecretToken"];
  if (typeof secretTokenAttribute === "object") {
    secretToken = secretTokenAttribute.stringValue ?? "";
  }

  const body = JSON.parse(record.body);
  await handleTelegramWebhook(secretToken, body);
}
