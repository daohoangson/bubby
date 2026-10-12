import assert from "node:assert/strict";
import test from "node:test";
import { syncTelegramCommands } from "./telegram-commands.ts";

test("sync removes the legacy default command menu", async () => {
  const request: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://api.telegram.org/bottest-token/deleteMyCommands");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { scope: { type: "default" }, language_code: "" });
    return Response.json({ ok: true, result: true });
  };
  await syncTelegramCommands("test-token", request);
});

test("sync reports rejected requests and hides credential-bearing network errors", async () => {
  await assert.rejects(syncTelegramCommands("test-token", async () => new Response("Unauthorized", { status: 401 })), /HTTP 401/);
  await assert.rejects(syncTelegramCommands("test-token", async () => { throw new Error("bottest-token"); }), /check network access/);
});
