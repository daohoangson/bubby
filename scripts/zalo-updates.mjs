import { getZaloWebhookInfo, ZaloApiError, zaloApi } from "../lib/zalo-api.ts";

try {
  const info = await getZaloWebhookInfo();
  if (info.result?.url) {
    throw new Error("A Zalo webhook is already registered. ID discovery uses getUpdates and cannot run alongside a webhook. Use a separate dev bot or inspect your existing webhook events; this command will not delete the webhook.");
  }
  console.log("Listening for 30 seconds. Send the bot a message now.");
  const update = await zaloApi("getUpdates", { timeout: 30 }).catch((error) => {
    if (error instanceof ZaloApiError && error.code === 408) return { result: null };
    throw error;
  });
  const message = update.result?.message;
  if (!message) {
    console.log("No message received. Send the bot a message, then run pnpm zalo:updates again.");
  } else {
    console.log(JSON.stringify({
      event: update.result.event_name,
      user_id: message.from?.id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.chat_type,
    }, null, 2));
  }
} catch (error) {
  let message = error instanceof Error ? error.message : "Zalo ID discovery failed";
  for (const credential of [process.env.ZALO_BOT_TOKEN, process.env.ZALO_WEBHOOK_SECRET_TOKEN].filter(Boolean)) {
    message = message.replaceAll(credential, "[REDACTED]");
  }
  console.error(message);
  process.exitCode = 1;
}
