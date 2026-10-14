import assert from "node:assert/strict";
import test from "node:test";
import type { SchedulePrincipalReference, ScheduleScopeContext } from "eve/experimental/schedules";
import { defaultTelegramAuth } from "eve/channels/telegram";
import { zaloAuth } from "./zalo-inbound.ts";
import { captureReminderDestination, deliverReminder, reminderInputSchema, resolveReminderAuth } from "./reminders.ts";

const env = { TELEGRAM_ALLOWED_USER_IDS: "123", TELEGRAM_ALLOWED_CHAT_IDS: "-10042",
  TELEGRAM_BOT_TOKEN: "test-secret", ZALO_ALLOWED_USER_IDS: "u1", ZALO_ALLOWED_CHAT_IDS: "g1",
  ZALO_BOT_TOKEN: "zalo-secret" };
function telegram(group = false, thread: number | undefined = 7): ScheduleScopeContext {
  const auth = defaultTelegramAuth({ chat: { id: group ? "-10042" : "123", type: group ? "supergroup" : "private" },
    from: { id: "123", isBot: false }, messageId: "10", messageThreadId: thread });
  return { abortSignal: new AbortController().signal, channel: { kind: "channel:telegram" },
    session: { id: "test", auth: { current: auth, initiator: auth } } };
}
function zalo(group = false): ScheduleScopeContext {
  const auth = zaloAuth({ from: { id: "u1", is_bot: false },
    chat: { id: group ? "g1" : "private-chat", chat_type: group ? "GROUP" : "PRIVATE" }, message_id: "m1" });
  return { abortSignal: new AbortController().signal, channel: { kind: "channel:zalo" },
    session: { id: "test", auth: { current: auth, initiator: auth } } };
}
function principal(context: ScheduleScopeContext): SchedulePrincipalReference {
  const auth = context.session.auth.current!;
  return { type: auth.principalType, authenticator: auth.authenticator, principalId: auth.principalId, issuer: auth.issuer };
}

test("capture uses real webhook identities and preserves Telegram topics and Zalo destinations", () => {
  for (const context of [telegram(), telegram(true), zalo(), zalo(true)]) {
    const destination = captureReminderDestination(context, env);
    assert.equal(destination.chatId, context.session.auth.current!.attributes.chat_id);
    assert.ok(resolveReminderAuth(principal(context), { text: "hello", destination }, env));
  }
  assert.deepEqual(captureReminderDestination(telegram(true), env), {
    channel: "telegram", chatId: "-10042", chatType: "supergroup", userId: "123", messageThreadId: 7,
  });
  const general = telegram(true);
  delete (general.session.auth.current!.attributes as Record<string, string>).message_thread_id;
  assert.equal("messageThreadId" in captureReminderDestination(general, env), false);
});

test("deny unallowed users, groups, non-webhook callers and inconsistent identities", () => {
  for (const context of [telegram(), telegram(true), zalo(), zalo(true)]) {
    assert.throws(() => captureReminderDestination(context, {}), /no longer allowed/);
  }
  const context = telegram();
  assert.throws(() => captureReminderDestination({ ...context, channel: { kind: "channel:eve" } }, env), /Telegram or Zalo/);
  const auth = context.session.auth.current!;
  for (const changed of [{ ...auth, principalType: "service" }, { ...auth, principalId: "telegram:999" },
    { ...auth, issuer: "other" }, { ...auth, attributes: { ...auth.attributes, message_thread_id: "invalid" } }]) {
    assert.throws(() => captureReminderDestination({ ...context,
      session: { ...context.session, auth: { current: changed, initiator: changed } } }, env));
  }
});

test("dispatch rechecks allowlists and creator identity rather than trusting stored grants", () => {
  for (const context of [telegram(), telegram(true), zalo(), zalo(true)]) {
    const payload = { text: "hello", destination: captureReminderDestination(context, env) };
    assert.equal(resolveReminderAuth(principal(context), payload, {}), null);
    assert.equal(resolveReminderAuth({ ...principal(context), principalId: "another-user" }, payload, env), null);
    assert.equal(resolveReminderAuth({ ...principal(context), authenticator: "other" }, payload, env), null);
    assert.equal(resolveReminderAuth({ ...principal(context), subject: "delegated" }, payload, env), null);
  }
});

test("model payload cannot select a destination and reminder text is bounded", () => {
  assert.deepEqual(reminderInputSchema.parse({ text: " hello ", destination: { chatId: "victim" } }), { text: "hello" });
  for (const text of [" ", "x".repeat(1801)]) assert.equal(reminderInputSchema.safeParse({ text }).success, false);
});

test("delivery sends saved text to the exact Telegram topic or Zalo chat without a model call", async () => {
  for (const context of [telegram(), telegram(true), zalo(), zalo(true)]) {
    const payload = { text: "Time to drink water", destination: captureReminderDestination(context, env) };
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    await deliverReminder(payload, env, async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true });
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.chat_id, payload.destination.chatId);
    assert.equal(requests[0].body.text, payload.text);
    if (payload.destination.channel === "telegram") assert.equal(requests[0].body.message_thread_id, 7);
    else assert.equal(requests[0].url, "https://bot-api.zaloplatforms.com/botzalo-secret/sendMessage");
  }
});

test("delivery rejects revoked destinations and reports API failures without exposing credentials", async () => {
  for (const context of [telegram(), zalo()]) {
    const payload = { text: "hello", destination: captureReminderDestination(context, env) };
    await assert.rejects(deliverReminder(payload, {}, async () => { assert.fail("must not send"); }), /no longer allowed/);
    for (const response of [new Response("failed", { status: 500 }), Response.json({ ok: false }), Response.json({})]) {
      await assert.rejects(deliverReminder(payload, env, async () => response), (error: Error) => {
        assert.doesNotMatch(error.message, /test-secret|zalo-secret/);
        return true;
      });
    }
    await assert.rejects(deliverReminder(payload, env, async () => { throw new Error("url with test-secret zalo-secret"); }),
      (error: Error) => { assert.doesNotMatch(error.message, /test-secret|zalo-secret/); return true; });
  }
});
