import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleScopeContext } from "eve/experimental/schedules";
import reminders from "./reminders.ts";

test("chat reminder mutations never park on an approval prompt that Zalo cannot display", async () => {
  for (const operation of ["create", "update", "enable", "disable", "invoke", "delete"] as const) {
    const approval = reminders.approval?.[operation];
    assert.ok(approval, `${operation} must override Eve's interactive approval default`);
    const result = typeof approval === "function" ? await approval({} as never) : await approval.request({} as never);
    assert.equal(result, "not-applicable", operation);
  }
});

test("collection isolates owners, captures trusted destinations, and denies non-chat management", async () => {
  const previous = process.env.TELEGRAM_ALLOWED_USER_IDS;
  process.env.TELEGRAM_ALLOWED_USER_IDS = "123,456";
  try {
    function caller(id: string): ScheduleScopeContext & { operation: "create"; name: string } {
      const auth = { authenticator: "telegram-webhook", issuer: "telegram", principalType: "user",
        principalId: `telegram:${id}`, attributes: { user_id: id, chat_id: id, chat_type: "private", message_thread_id: "7" } };
      return { abortSignal: new AbortController().signal, operation: "create", name: "drink-water",
        channel: { kind: "channel:telegram" }, session: { id: "test", auth: { current: auth, initiator: auth } } };
    }
    const first = caller("123"), second = caller("456");
    const firstScope = await reminders.scope!(first);
    assert.ok(firstScope);
    assert.notDeepEqual(firstScope, await reminders.scope!(second));
    const input = reminders.inputSchema;
    // Normalization strips a destination injected into the model tool input.
    const validated = await input["~standard"].validate({ text: "Drink water", destination: { chatId: "456" } });
    if (validated.issues) assert.fail("valid reminder was rejected");
    const prepared = await reminders.preparePayload!(validated.value, first);
    assert.equal(prepared.destination.chatId, "123");
    assert.deepEqual(prepared, await reminders.preparePayload!(validated.value, first));
    assert.equal(await reminders.scope!({ ...first, channel: { kind: "channel:eve" } }), null);
    process.env.TELEGRAM_ALLOWED_USER_IDS = "456";
    assert.equal(await reminders.scope!({ ...first, operation: "delete" }), null);
    const auth = first.session.auth.current!;
    assert.equal(await reminders.auth({ payload: prepared,
      principal: { type: auth.principalType, principalId: auth.principalId, authenticator: auth.authenticator, issuer: auth.issuer },
      occurrence: { collection: "reminders", name: "drink-water", scheduleId: "s1", executionId: "e1", scheduledAt: "2026-10-14T03:00:00Z" } }), null);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_ALLOWED_USER_IDS;
    else process.env.TELEGRAM_ALLOWED_USER_IDS = previous;
  }
});
