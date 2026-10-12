import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:2000";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)) {
  throw new Error("This smoke test is restricted to a local server");
}
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
assert.ok(secret, "Set TELEGRAM_WEBHOOK_SECRET_TOKEN in .env.local");
assert.ok((await fetch(new URL("/eve/v1/health", base))).ok, "Health check");
async function post(body, token) {
  return fetch(new URL("/eve/v1/telegram", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": token },
    body: JSON.stringify(body),
  });
}
assert.equal((await post({ update_id: 1 }, "invalid")).status, 401);
assert.equal((await post({ update_id: 2, edited_message: { text: "ignored" } }, secret)).status, 200);
assert.equal((await post({ update_id: 3, message: { message_id: 1, date: 0,
  chat: { id: 0, type: "private" }, from: { id: 0, is_bot: true, first_name: "Smoke" }, text: "ignored" } }, secret)).status, 200);
console.log("Passed: health, invalid secret → 401, unsupported update → 200, bot sender → 200 (ignored).");
