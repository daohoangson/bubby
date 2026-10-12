const [baseUrl] = process.argv.slice(2);
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
if (!baseUrl || !token || !secret) {
  throw new Error("Usage: pnpm telegram:webhook https://your-host (requires Telegram credentials in .env.local)");
}
const url = new URL("/eve/v1/telegram", baseUrl);
if (url.protocol !== "https:") throw new Error("Telegram requires an HTTPS webhook URL");
const health = await fetch(new URL("/eve/v1/health", url));
if (!health.ok) throw new Error(`Agent health check failed: ${health.status}`);
try {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.href,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram rejected registration: ${result.description}`);
  console.log(`Webhook registered: ${url.href}. Pending updates preserved.`);
} catch (error) {
  // Fetch errors can contain a URL with the bot token; never print them directly.
  console.error(error instanceof Error ? error.message.replaceAll(token, "[REDACTED]") : "Webhook registration failed");
  process.exitCode = 1;
}
