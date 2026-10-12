import assert from "node:assert/strict";
import test from "node:test";
import { authorizeSelfModification } from "./self-modification-access.ts";

const owner = {
  authenticator: "telegram-webhook",
  principalId: "telegram:552046506",
  attributes: { chat_type: "private" },
};

test("self modification admits the owner in private chats and topics", () => {
  assert.equal(authorizeSelfModification({ channel: { kind: "channel:telegram" }, principal: owner }), true);
});

test("self modification denies other users, groups, HTTP and missing authentication", () => {
  const telegram = { kind: "channel:telegram" };
  for (const context of [
    { channel: telegram, principal: { ...owner, principalId: "telegram:123" } },
    { channel: telegram, principal: { ...owner, attributes: { chat_type: "supergroup" } } },
    { channel: telegram, principal: { ...owner, authenticator: "oidc" } },
    { channel: { kind: "http" }, principal: owner },
    { channel: telegram, principal: null },
  ]) assert.equal(authorizeSelfModification(context), false);
});
