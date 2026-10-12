import assert from "node:assert/strict";
import test from "node:test";
import type { TelegramChannelState, TelegramHandle } from "eve/channels/telegram";
import { clearTelegramProgress, showTelegramProgress, telegramToolStatus } from "./telegram-progress.ts";

type ProgressState = TelegramChannelState & { progressMessage?: { id: string; text: string; updatedAt: number } };
function progressChannel() {
  const state: ProgressState = { chatId: "-100123", chatType: "supergroup", conversationId: "42", messageThreadId: 73 };
  const posts: Parameters<TelegramHandle["post"]>[0][] = [];
  const edits: Parameters<TelegramHandle["editMessageText"]>[0][] = [];
  const requests: { method: string; body: Parameters<TelegramHandle["request"]>[1] }[] = [];
  const telegram: Pick<TelegramHandle, "chatId" | "post" | "editMessageText" | "request"> = {
    chatId: "-100123",
    async post(message) { posts.push(message); return { id: "456", raw: { ok: true } }; },
    async editMessageText(input) { edits.push(input); return { ok: true, status: 200, body: { ok: true } }; },
    async request(method, body) { requests.push({ method, body }); return { ok: true, status: 200, body: { ok: true } }; },
  };
  return { state, telegram, posts, edits, requests };
}

test("progress posts silently once, deduplicates unchanged text, and edits changed text", async () => {
  const channel = progressChannel();
  await showTelegramProgress(channel, "Working...", 10_000);
  await showTelegramProgress(channel, "Working...", 10_000);
  assert.deepEqual(channel.posts, [{ text: "Working...", disable_notification: true }]);
  assert.deepEqual(channel.edits, []);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Working...", updatedAt: 10_000 });
  await showTelegramProgress(channel, "Installing dependencies...", 12_000);
  await showTelegramProgress(channel, "Installing dependencies...", 12_000);
  assert.equal(channel.posts.length, 1);
  assert.deepEqual(channel.edits, [{ messageId: "456", text: "Installing dependencies..." }]);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Installing dependencies...", updatedAt: 12_000 });
});

test("changing progress is throttled for two seconds after successful posts and edits", async () => {
  const channel = progressChannel();
  await showTelegramProgress(channel, "Working...", 10_000);
  await showTelegramProgress(channel, "Working...", 11_998);
  await showTelegramProgress(channel, "Reading files...", 11_999);
  assert.deepEqual(channel.edits, []);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Working...", updatedAt: 10_000 });
  await showTelegramProgress(channel, "Reading files...", 12_000);
  await showTelegramProgress(channel, "Creating your file...", 13_999);
  assert.deepEqual(channel.edits, [{ messageId: "456", text: "Reading files..." }]);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Reading files...", updatedAt: 12_000 });
  await showTelegramProgress(channel, "Creating your file...", 14_000);
  assert.equal(channel.edits.length, 2);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Creating your file...", updatedAt: 14_000 });
});

test("clear deletes the original progress message and does nothing once cleared", async () => {
  const channel = progressChannel();
  await showTelegramProgress(channel, "Reading files...", 12_000);
  await clearTelegramProgress(channel);
  await clearTelegramProgress(channel);
  assert.deepEqual(channel.requests, [{ method: "deleteMessage", body: { chat_id: "-100123", message_id: "456" } }]);
  assert.equal(channel.state.progressMessage, undefined);
});

test("failed deletion keeps progress state so a later clear retries", async () => {
  const channel = progressChannel();
  await showTelegramProgress(channel, "Working...", 10_000);
  let attempts = 0;
  channel.telegram.request = async () => {
    attempts++;
    return { ok: attempts > 1, status: attempts > 1 ? 200 : 503, body: { ok: attempts > 1 } };
  };
  await clearTelegramProgress(channel);
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Working...", updatedAt: 10_000 });
  await clearTelegramProgress(channel);
  assert.equal(attempts, 2);
  assert.equal(channel.state.progressMessage, undefined);
});

test("rejected edits retain the old text so the same update can retry", async () => {
  const channel = progressChannel();
  await showTelegramProgress(channel, "Working...", 10_000);
  let attempts = 0;
  channel.telegram.editMessageText = async () => {
    attempts++;
    return { ok: attempts > 1, status: attempts > 1 ? 200 : 503, body: { ok: attempts > 1 } };
  };
  await showTelegramProgress(channel, "Reading files...", 12_000);
  assert.equal(channel.state.progressMessage?.text, "Working...");
  await showTelegramProgress(channel, "Reading files...", 12_000);
  assert.equal(attempts, 2);
  assert.equal(channel.state.progressMessage?.text, "Reading files...");
});

test("post, edit, and delete exceptions never block the response or discard retry state", async () => {
  const channel = progressChannel();
  channel.telegram.post = async () => { throw new Error("Telegram unavailable"); };
  await assert.doesNotReject(showTelegramProgress(channel, "Working...", 10_000));
  assert.equal(channel.state.progressMessage, undefined);
  channel.state.progressMessage = { id: "456", text: "Working...", updatedAt: 10_000 };
  channel.telegram.editMessageText = async () => { throw new Error("Telegram unavailable"); };
  await assert.doesNotReject(showTelegramProgress(channel, "Creating your file...", 12_000));
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Working...", updatedAt: 10_000 });
  channel.telegram.request = async () => { throw new Error("Telegram unavailable"); };
  await assert.doesNotReject(clearTelegramProgress(channel));
  assert.deepEqual(channel.state.progressMessage, { id: "456", text: "Working...", updatedAt: 10_000 });
});

test("tool activity maps to concise user-facing progress labels", () => {
  const cases = [
    { toolName: "bash", command: "cd /workspace && npm install csv-parse", text: "Installing dependencies..." },
    { toolName: "bash", command: "node /workspace/parse.cjs", text: "Working in the sandbox..." },
    { toolName: "read_file", text: "Reading files..." },
    { toolName: "glob", text: "Reading files..." },
    { toolName: "write_file", text: "Creating your file..." },
    { toolName: "publish_file", text: "Sending your file..." },
    { toolName: "other", text: "Working..." },
  ];
  for (const { toolName, command, text } of cases) {
    assert.equal(telegramToolStatus([{ kind: "tool-call", toolName, input: { command } }]), text);
  }
  assert.equal(telegramToolStatus([]), "Working...");
  assert.equal(telegramToolStatus([{ kind: "subagent-call" }]), "Working...");
});
