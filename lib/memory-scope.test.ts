import assert from "node:assert/strict";
import test from "node:test";
import type { MemoryScopeContext } from "eve/memory";
import { defaultTelegramAuth } from "eve/channels/telegram";
import { byPrincipal } from "eve/memory/scope";
import { telegramMemoryScope } from "./memory-scope.ts";

const env = { TELEGRAM_ADMIN_IDS: "123, 456", TELEGRAM_ALLOWED_CHAT_IDS: "-10042" };

function context(userId = "123", topic?: number): MemoryScopeContext {
  const principal = defaultTelegramAuth({
    chat: { id: userId, type: "private" },
    from: { id: userId, isBot: false },
    messageId: "1",
    messageThreadId: topic,
  });
  return {
    abortSignal: new AbortController().signal,
    channel: { kind: "channel:telegram" },
    session: { id: `session-${topic ?? "main"}`, auth: { current: principal, initiator: principal } },
  };
}

test("private topics share built-in principal scope while allowed users stay isolated", () => {
  const first = context("123", 1);
  const second = context("123", 2);
  assert.equal(telegramMemoryScope(first, env), byPrincipal(first));
  assert.equal(telegramMemoryScope(first, env), telegramMemoryScope(second, env));
  assert.equal(telegramMemoryScope(first, env), telegramMemoryScope(context("123"), env));
  assert.notEqual(telegramMemoryScope(first, env), telegramMemoryScope(context("456"), env));
});

test("personal memory excludes unapproved users and absent allowlists", () => {
  assert.equal(telegramMemoryScope(context("12"), env), null);
  assert.equal(telegramMemoryScope(context("789"), env), null);
  assert.equal(telegramMemoryScope(context(), {}), null);
});

test("personal memory rejects groups, HTTP, missing and non-Telegram authentication", () => {
  const base = context();
  const principal = base.session.auth.current!;
  const rejected: MemoryScopeContext[] = [
    { ...base, channel: { kind: "channel:eve" } },
    { ...base, session: { ...base.session, auth: { current: null, initiator: principal } } },
    ...[
      { ...principal, attributes: { ...principal.attributes, chat_type: "supergroup", chat_id: "-10042" } },
      { ...principal, attributes: { ...principal.attributes, chat_type: "group" } },
      { ...principal, attributes: { ...principal.attributes, chat_type: "channel" } },
      { ...principal, authenticator: "oidc" },
      { ...principal, principalType: "service" },
      { ...principal, principalType: "local-dev" },
      { ...principal, issuer: "another-system" },
      { ...principal, principalId: "telegram:456" },
      { ...principal, attributes: { ...principal.attributes, chat_id: "456" } },
      { ...principal, attributes: { chat_type: "private" } },
    ].map((current) => ({ ...base, session: { ...base.session, auth: { current, initiator: principal } } })),
  ];
  for (const candidate of rejected) assert.equal(telegramMemoryScope(candidate, env), null);
});
