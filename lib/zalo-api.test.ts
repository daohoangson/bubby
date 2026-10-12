import assert from "node:assert/strict";
import test from "node:test";
import { getZaloWebhookInfo, splitZaloText, ZaloApiError, zaloApi } from "./zalo-api.ts";

test("long Zalo replies respect the 2000-unit limit and preserve Unicode", () => {
  const text = "a".repeat(1999) + "😀" + "xin chào".repeat(500);
  const chunks = splitZaloText(text);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 2000 && !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk)));
  assert.deepEqual(splitZaloText(""), []);
});

test("Zalo API sends JSON and accepts typing success without result", async () => {
  const request: typeof fetch = async (url, init) => {
    assert.equal(url, "https://bot-api.zaloplatforms.com/bottest-token/sendChatAction");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { chat_id: "person", action: "typing" });
    return Response.json({ ok: true });
  };
  assert.deepEqual(await zaloApi("sendChatAction", { chat_id: "person", action: "typing" },
    { ZALO_BOT_TOKEN: "test-token" }, request), { ok: true });
});

test("Zalo failures do not leak credentials or provider response bodies", async () => {
  const env = { ZALO_BOT_TOKEN: "sensitive-test-token" };
  await assert.rejects(zaloApi("sendMessage", {}, env, async () => {
    throw new Error(`https://bot-api.zaloplatforms.com/bot${env.ZALO_BOT_TOKEN}/sendMessage`);
  }), { message: "Zalo sendMessage request failed" });
  await assert.rejects(zaloApi("sendMessage", {}, env, async () => Response.json({
    ok: false, description: env.ZALO_BOT_TOKEN,
  })), { message: "Zalo sendMessage did not confirm success" });
});

test("live API conventions: absent webhook is 404, empty polling is 408", async (t) => {
  const previous = process.env.ZALO_BOT_TOKEN;
  process.env.ZALO_BOT_TOKEN = "test-token";
  t.after(() => {
    if (previous === undefined) delete process.env.ZALO_BOT_TOKEN;
    else process.env.ZALO_BOT_TOKEN = previous;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error_code: 404 }));
  assert.deepEqual(await getZaloWebhookInfo(), { ok: true, result: null });
  await assert.rejects(zaloApi("getUpdates", {}, { ZALO_BOT_TOKEN: "test-token" },
    async () => Response.json({ ok: false, error_code: 408 })), (error: Error) =>
      error instanceof ZaloApiError && error.code === 408);
});
