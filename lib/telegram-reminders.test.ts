import assert from "node:assert/strict";
import test from "node:test";
import { defaultTelegramAuth } from "eve/channels/telegram";
import type { ScheduleScopeContext, SchedulePrincipalReference } from "eve/experimental/schedules";
import { prepareReminder, reminderAuth, reminderScope } from "./telegram-reminders.ts";

const env = { TELEGRAM_ADMIN_IDS: "123,456", TELEGRAM_ALLOWED_CHAT_IDS: "-10042" };
function context(userId = "123", topic = 7, group = false): ScheduleScopeContext {
  const principal = defaultTelegramAuth({
    chat: { id: group ? "-10042" : userId, type: group ? "supergroup" : "private" },
    from: { id: userId, isBot: false }, messageId: "1", messageThreadId: topic,
  });
  return {
    abortSignal: new AbortController().signal, channel: { kind: "channel:telegram" },
    session: { id: "test", auth: { current: principal, initiator: principal } },
  };
}
function creator(ctx: ScheduleScopeContext): SchedulePrincipalReference {
  const auth = ctx.session.auth.current!;
  return { type: auth.principalType, authenticator: auth.authenticator, issuer: auth.issuer, principalId: auth.principalId };
}

test("reminders capture trusted private/group topics and isolate each creator's management scope", () => {
  for (const group of [false, true]) {
    const ctx = context("123", 7, group);
    const payload = prepareReminder({ task: "Book hotel" }, ctx, env);
    assert.deepEqual(payload.destination, {
      chatId: group ? "-10042" : "123", chatType: group ? "supergroup" : "private", userId: "123", messageThreadId: 7,
    });
    assert.ok(reminderAuth({ principal: creator(ctx), payload }, env));
    assert.equal(reminderScope(ctx, env), reminderScope(context("123", 8, group), env));
    assert.notEqual(reminderScope(ctx, env), reminderScope(context("456", 7, group), env));
  }
});

test("reminders deny forged identity, unapproved destinations, HTTP and model-selected recipients", () => {
  const base = context();
  const auth = base.session.auth.current!;
  const rejected: ScheduleScopeContext[] = [
    context("789"), { ...base, channel: { kind: "channel:eve" } },
    ...[
      null, { ...auth, authenticator: "oidc" }, { ...auth, issuer: "other" },
      { ...auth, principalId: "telegram:456" }, { ...auth, principalType: "service" },
      { ...auth, attributes: { ...auth.attributes, chat_id: "456" } },
      { ...auth, attributes: { ...auth.attributes, message_thread_id: "invalid" } },
    ].map(current => ({ ...base, session: { ...base.session, auth: { current, initiator: auth } } })),
  ];
  for (const ctx of rejected) {
    assert.equal(reminderScope(ctx, env), null);
    assert.throws(() => prepareReminder({ task: "Book hotel" }, ctx, env));
  }
  const forgedInput = { task: "Book hotel", destination: { chatId: "456" } };
  assert.throws(() => prepareReminder(forgedInput, base, env));
});

test("dispatch rechecks revoked access and rejects a different creator or substituted private recipient", () => {
  for (const group of [false, true]) {
    const ctx = context("123", 7, group);
    const principal = creator(ctx);
    const payload = prepareReminder({ task: "Book hotel" }, ctx, env);
    assert.equal(reminderAuth({ principal, payload }, {}), null);
    assert.equal(reminderAuth({ principal: creator(context("456", 7, group)), payload }, env), null);
  }
  const ctx = context();
  const payload = prepareReminder({ task: "Book hotel" }, ctx, env);
  assert.equal(reminderAuth({ principal: creator(ctx), payload: { ...payload, destination: { ...payload.destination, chatId: "456" } } }, env), null);
});
