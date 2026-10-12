import assert from "node:assert/strict";
import test from "node:test";
import type { RouteHandlerArgs, Session } from "eve/channels";
import { telegramChannel, type TelegramChannelState } from "eve/channels/telegram";
import { withTopicConversations } from "./telegram-topics.ts";

function unexpectedCall(): never { throw new Error("Unexpected test double call"); }
const session: Session = {
  id: "test-session", send: unexpectedCall, respond: unexpectedCall, cancel: unexpectedCall,
  compact: unexpectedCall, clear: unexpectedCall, reset: unexpectedCall,
  getEventStream: unexpectedCall, getStreamTailIndex: unexpectedCall,
};

test("forum messages share context by topic while groups and private chats retain Eve routing", async () => {
  const channel = withTopicConversations(telegramChannel({
    credentials: { webhookSecretToken: "test-secret" },
    onMessage: () => ({ auth: null }),
  }));
  const route = channel.routes[0]!;
  assert.notEqual(route.transport, "websocket");
  if (route.transport === "websocket") return;
  const addresses: string[] = [];
  const deliveries: TelegramChannelState[] = [];
  const pending: Promise<void>[] = [];
  const args: RouteHandlerArgs<TelegramChannelState> = {
    from(address: string) {
      addresses.push(address);
      return {
        async send(_message, options) { deliveries.push(options.state); return session; },
        respond: unexpectedCall, cancel: unexpectedCall, compact: unexpectedCall,
        clear: unexpectedCall, reset: unexpectedCall,
      };
    },
    waitUntil(task) { pending.push(task.then(() => {})); },
    resolveSession: unexpectedCall, attachSession: unexpectedCall, to: unexpectedCall,
    params: {}, requestIp: null, describe: unexpectedCall, listSkillFiles: unexpectedCall,
    readSkill: unexpectedCall, invokeTool: unexpectedCall,
  };
  async function send(chat: { id: number; type: string; is_forum?: boolean }, id: number, topic?: number, secret = "test-secret") {
    return route.handler(new Request("http://localhost/eve/v1/telegram", {
      method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify({ message: { message_id: id, chat, message_thread_id: topic,
        from: { id: 42, is_bot: false }, text: "hello" } }),
    }), args);
  }
  const forum = { id: -10042, type: "supergroup", is_forum: true };
  await send(forum, 10, 7);
  await send(forum, 11, 7);
  await send(forum, 12, 8);
  await send({ ...forum, id: -10043 }, 13, 7);
  await send(forum, 14);
  await send({ id: -42, type: "group" }, 15);
  await send({ id: 42, type: "private" }, 16);
  await Promise.all(pending);
  assert.deepEqual(addresses, ["forum:-10042:7", "forum:-10042:7", "forum:-10042:8",
    "forum:-10043:7", "forum:-10042:1", "-42::15", "42::"]);
  assert.equal(deliveries[0]!.messageThreadId, 7);
  assert.equal(deliveries[2]!.messageThreadId, 8);
  const count = addresses.length;
  const rejected = await send(forum, 17, 7, "wrong-secret");
  assert.ok(rejected instanceof Response);
  assert.equal(rejected.status, 401);
  await Promise.all(pending);
  assert.equal(addresses.length, count);
});
