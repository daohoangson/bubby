import assert from "node:assert/strict";
import test from "node:test";
import { checkTelegramSettings } from "./telegram-settings.ts";

const env = { TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_BOT_USERNAME: "bubby_test_bot",
  TELEGRAM_ALLOWED_USER_IDS: "42", TELEGRAM_ALLOWED_CHAT_IDS: "-10042" };
const bot = { id: 123, is_bot: true, username: "bubby_test_bot" };

test("settings check reads getMe and reports a configured bot without changing settings", async () => {
  const calls: string[] = [];
  const request: typeof fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.method, "POST");
    return Response.json({ ok: true, result: { ...bot, can_join_groups: true,
      can_read_all_group_messages: true, has_topics_enabled: true, allows_users_to_create_topics: true } });
  };
  const lines = await checkTelegramSettings(env, request);
  assert.deepEqual(calls, ["https://api.telegram.org/bottest-token/getMe"]);
  assert.equal(lines.some((line) => line.startsWith("SETUP:")), false);
  assert.ok(lines.some((line) => line.includes("conversion can change its chat ID")));
});

test("omitted capability flags produce actionable BotFather and allowlist reminders", async () => {
  const request: typeof fetch = async () => Response.json({ ok: true, result: bot });
  const lines = await checkTelegramSettings({ TELEGRAM_BOT_TOKEN: "test-token" }, request);
  const output = lines.join("\n");
  for (const reminder of ["enable Threaded Mode", "Allow Groups?", "/setprivacy", "TELEGRAM_ALLOWED_USER_IDS", "Group access is disabled"]) {
    assert.ok(output.includes(reminder));
  }
  const topicsRequest: typeof fetch = async () => Response.json({ ok: true, result: { ...bot, has_topics_enabled: true } });
  assert.ok((await checkTelegramSettings(env, topicsRequest)).some((line) => line.includes("turn off 'Disallow users")));
});

test("wrong bot identity and invalid credentials fail before webhook registration", async () => {
  const request: typeof fetch = async () => Response.json({ ok: true, result: { ...bot, username: "different_bot" } });
  await assert.rejects(checkTelegramSettings(env, request), /Fix .env.local before registering/);
  await assert.rejects(checkTelegramSettings(env, async () => new Response("Unauthorized", { status: 401 })), /HTTP 401/);
  await assert.rejects(checkTelegramSettings(env, async () => { throw new Error("https://api.telegram.org/bottest-token/getMe"); }), /check network access/);
});
