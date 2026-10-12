import assert from "node:assert/strict";
import test from "node:test";
import { canChatOnZalo, verifyZaloWebhook, zaloAuth, zaloContent, zaloMessageSchema } from "./zalo-inbound.ts";
import { authorizeSelfModification } from "./self-modification-access.ts";

const message = zaloMessageSchema.parse({
  from: { id: "owner", is_bot: false }, chat: { id: "owner-chat", chat_type: "PRIVATE" },
  message_id: "message-1", text: "hello",
});

test("Zalo private and group access use separate exact allowlists and reject bots", () => {
  const env = { ZALO_ALLOWED_USER_IDS: "owner, friend", ZALO_ALLOWED_CHAT_IDS: "group" };
  assert.equal(canChatOnZalo(message, env), true);
  assert.equal(canChatOnZalo(message, {}), false);
  assert.equal(canChatOnZalo({ ...message, from: { id: "own", is_bot: false } }, env), false);
  assert.equal(canChatOnZalo({ ...message, from: { id: "owner", is_bot: true } }, env), false);
  assert.equal(canChatOnZalo({ ...message, chat: { id: "unapproved", chat_type: "GROUP" } }, env), false);
  assert.equal(canChatOnZalo({ ...message, chat: { id: "group", chat_type: "GROUP" } }, env), true);
  assert.equal(authorizeSelfModification({ channel: { kind: "channel:zalo" }, principal: zaloAuth(message) }), false);
});

test("Zalo requires a configured secret and its own exact header", () => {
  const request = (secret: string) => new Request("http://localhost/webhooks/zalo", {
    headers: { "x-bot-api-secret-token": secret },
  });
  assert.equal(verifyZaloWebhook(request("secret-123"), "secret-123"), true);
  assert.equal(verifyZaloWebhook(request("secret-124"), "secret-123"), false);
  assert.equal(verifyZaloWebhook(request("secret-123")), false);
  assert.equal(verifyZaloWebhook(request(""), ""), false);
});

test("Zalo maps supported text and images; unsupported media never masquerades as text", () => {
  assert.deepEqual(zaloContent("message.text.received", message), [{ type: "text", text: "hello" }]);
  const photo = { ...message, photo: "https://example.com/photo.png", caption: "What's here?" };
  assert.deepEqual(zaloContent("message.image.received", photo), [
    { type: "text", text: "What's here?" }, { type: "image", image: new URL(photo.photo) },
  ]);
  assert.equal(zaloContent("message.voice.received", message), null);
  assert.equal(zaloContent("message.text.received", { ...message, text: "  " }), null);
  assert.equal(zaloMessageSchema.safeParse({ ...message, photo: "http://localhost/secret" }).success, false);
});
