import assert from "node:assert/strict";
import test from "node:test";
import type { RouteHandlerArgs } from "eve/channels";
import type { TelegramChannelState } from "eve/channels/telegram";
import channel from "./telegram.ts";

function unexpectedCall(): never { throw new Error("Unexpected test double call"); }

test("messages without a thread ID are acknowledged without typing or agent dispatch", async (t) => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  process.env.TELEGRAM_ADMIN_IDS = "42";
  process.env.TELEGRAM_ALLOWED_CHAT_IDS = "-10042";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = "test-secret";
  let requests = 0;
  let deliveries = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return Response.json({ ok: true }); });
  const pending: Promise<void>[] = [];
  const args: RouteHandlerArgs<TelegramChannelState> = {
    from() { deliveries++; return unexpectedCall(); },
    waitUntil(task) { pending.push(task.then(() => {})); },
    resolveSession: unexpectedCall, attachSession: unexpectedCall, to: unexpectedCall,
    params: {}, requestIp: null, describe: unexpectedCall, listSkillFiles: unexpectedCall,
    readSkill: unexpectedCall, invokeTool: unexpectedCall,
  };
  const route = channel.routes[0]!;
  if (route.transport === "websocket") throw new Error("Expected Telegram HTTP route");
  for (const chat of [{ id: 42, type: "private" }, { id: -10042, type: "supergroup", is_forum: true }]) {
    for (const content of [{ text: "Opening message without topic metadata" },
      { document: { file_id: "test-file", mime_type: "application/pdf" } }]) {
      const response = await route.handler(new Request("http://localhost/eve/v1/telegram", {
        method: "POST", headers: { "x-telegram-bot-api-secret-token": "test-secret" },
        body: JSON.stringify({ message: { message_id: 1, chat, from: { id: 42, is_bot: false }, ...content } }),
      }), args);
      assert.ok(response instanceof Response);
      assert.equal(response.status, 200);
    }
  }
  await Promise.all(pending);
  assert.equal(requests, 0);
  assert.equal(deliveries, 0);
});
