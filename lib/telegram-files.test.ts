import assert from "node:assert/strict";
import test from "node:test";
import type { SandboxSession } from "eve/sandbox";
import { readOutputFile } from "./output-files.ts";
import { sendTelegramFile } from "./telegram-files.ts";

const token = "test-secret-token";
const bytes = Buffer.from('name,amount\r\n"Paper, recycled",12\r\n');
function sandboxFor(data = bytes): Pick<SandboxSession, "readFile"> {
  return { async readFile() {
    return new ReadableStream({ start(controller) { controller.enqueue(data); controller.close(); } });
  } };
}

for (const messageThreadId of [73, undefined]) {
  test(`sendDocument preserves multipart bytes and ${messageThreadId ? "topic" : "private chat"} destination`, async () => {
    const sandbox = sandboxFor();
    const { file } = await readOutputFile(sandbox, "invoice.csv");
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), `https://api.telegram.org/bot${token}/sendDocument`);
      assert.equal(init?.method, "POST");
      assert.ok(init?.signal instanceof AbortSignal);
      assert.ok(init?.body instanceof FormData);
      assert.equal(init.body.get("chat_id"), "-100123");
      assert.equal(init.body.get("message_thread_id"), messageThreadId ? String(messageThreadId) : null);
      const document = init.body.get("document");
      assert.ok(document instanceof File);
      assert.equal(document.name, "invoice.csv");
      assert.equal(document.type, "text/csv");
      assert.deepEqual(Buffer.from(await document.arrayBuffer()), bytes);
      return Response.json({ ok: true, result: { message_id: 456 } });
    };
    assert.deepEqual(await sendTelegramFile({ sandbox, file, chatId: "-100123", messageThreadId, token }, request),
      { messageId: 456, filename: "invoice.csv" });
    assert.equal(calls, 1);
  });
}

test("changed file bytes prevent delivery before making a Telegram request", async () => {
  const { file } = await readOutputFile(sandboxFor(), "invoice.csv");
  // Same length detects content changes independently of the size check.
  const changed = Buffer.from(bytes);
  changed[0] = "N".charCodeAt(0);
  const request: typeof fetch = async () => { assert.fail("Changed files must not be sent"); };
  await assert.rejects(sendTelegramFile({ sandbox: sandboxFor(changed), file, chatId: "1", token }, request), /changed before delivery/);
});

test("HTTP rejection, Telegram rejection, and network failures hide token-bearing details", async () => {
  const sandbox = sandboxFor();
  const { file } = await readOutputFile(sandbox, "invoice.csv");
  const cases: { request: typeof fetch; error: RegExp }[] = [
    { request: async () => new Response(`Rejected bot${token}`, { status: 401 }), error: /HTTP 401/ },
    { request: async () => Response.json({ ok: false, description: `Rejected bot${token}` }), error: /did not confirm/ },
    { request: async () => new Response(`Malformed bot${token}`), error: /did not confirm/ },
    { request: async () => new Response(new ReadableStream({ start(controller) {
      controller.error(new Error(`Response failed: bot${token}`));
    } })), error: /did not confirm/ },
    { request: async () => { throw new Error(`Request failed: https://api.telegram.org/bot${token}/sendDocument`); }, error: /delivery failed; try again/ },
  ];
  for (const { request, error } of cases) {
    await assert.rejects(sendTelegramFile({ sandbox, file, chatId: "1", token }, request), failure => {
      assert.ok(failure instanceof Error);
      assert.match(failure.message, error);
      assert.ok(!failure.message.includes(token));
      return true;
    });
  }
});
