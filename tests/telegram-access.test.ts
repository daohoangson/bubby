import assert from "node:assert/strict";
import test from "node:test";
import { canChat } from "../lib/telegram-access.ts";

const env = { TELEGRAM_ADMIN_IDS: "123, 456", TELEGRAM_ALLOWED_CHAT_IDS: "-10042" };
const message = (id: string, type = "private", chatId = id, isBot = false) => ({
  chat: { id: chatId, type }, from: { id, isBot },
});

test("private chats require an exact admin ID", () => {
  assert.equal(canChat(message("123"), env), true);
  assert.equal(canChat(message("456"), env), true);
  assert.equal(canChat(message("12"), env), false);
  assert.equal(canChat(message("123"), {}), false);
});
test("group access requires an explicit approved chat", () => {
  assert.equal(canChat(message("789", "supergroup", "-10042"), env), true);
  assert.equal(canChat(message("123", "group", "-999"), env), false);
});
test("bots, missing senders, and channels cannot start runs", () => {
  assert.equal(canChat(message("123", "private", "123", true), env), false);
  assert.equal(canChat({ chat: { id: "123", type: "private" } }, env), false);
  assert.equal(canChat(message("123", "channel"), env), false);
});
