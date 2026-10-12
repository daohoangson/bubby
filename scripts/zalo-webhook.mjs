import { zaloApi } from "../lib/zalo-api.ts";

const [baseUrl] = process.argv.slice(2);
const token = process.env.ZALO_BOT_TOKEN;
const secret = process.env.ZALO_WEBHOOK_SECRET_TOKEN;

try {
  if (!baseUrl || !token || !secret) {
    throw new Error("Usage: pnpm zalo:webhook https://your-host (requires ZALO_BOT_TOKEN and ZALO_WEBHOOK_SECRET_TOKEN in .env.local)");
  }
  if (secret.length < 8 || secret.length > 256) {
    throw new Error("ZALO_WEBHOOK_SECRET_TOKEN must contain 8–256 characters");
  }
  const allowedIds = [process.env.ZALO_ALLOWED_USER_IDS, process.env.ZALO_ALLOWED_CHAT_IDS]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedIds.length) {
    throw new Error("Set ZALO_ALLOWED_USER_IDS or ZALO_ALLOWED_CHAT_IDS before registering the webhook. Use pnpm zalo:updates to discover IDs first.");
  }
  const url = new URL("/webhooks/zalo", baseUrl);
  if (url.protocol !== "https:") throw new Error("Zalo requires an HTTPS webhook URL");
  if (url.username || url.password) throw new Error("Webhook URL must not contain credentials");
  const health = await fetch(new URL("/eve/v1/health", url), { signal: AbortSignal.timeout(15_000) });
  if (!health.ok) throw new Error(`Agent health check failed: ${health.status}`);
  const bot = await zaloApi("getMe", {});
  if (!bot.result?.id) throw new Error("Zalo getMe did not return a bot ID");
  console.log(`Zalo bot ID: ${bot.result.id}. Group access: ${bot.result.can_join_groups === true ? "enabled" : "unavailable"}.`);
  const registration = await zaloApi("setWebhook", { url: url.href, secret_token: secret });
  if (registration.result?.verification?.ok !== true) {
    throw new Error("Zalo saved the webhook but verification failed. Check that the public URL reaches this agent and uses the same ZALO_WEBHOOK_SECRET_TOKEN, then run registration again.");
  }
  const info = await zaloApi("getWebhookInfo", {});
  if (info.result?.url !== url.href) throw new Error("Zalo webhook URL does not match the requested URL");
  console.log(`Webhook registered and verified: ${url.href}`);
} catch (error) {
  let message = error instanceof Error ? error.message : "Zalo webhook registration failed";
  for (const credential of [token, secret].filter(Boolean)) message = message.replaceAll(credential, "[REDACTED]");
  console.error(message);
  process.exitCode = 1;
}
