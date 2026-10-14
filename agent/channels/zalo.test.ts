import assert from "node:assert/strict";
import test from "node:test";
import type { RouteHandlerArgs, Session } from "eve/channels";
import type { UserContent } from "ai";
import channel from "./zalo.ts";

function unexpectedCall(): never { throw new Error("Unexpected test double call"); }
const session: Session = {
  id: "test-session", send: unexpectedCall, respond: unexpectedCall, cancel: unexpectedCall,
  compact: unexpectedCall, clear: unexpectedCall, reset: unexpectedCall,
  getEventStream: unexpectedCall, getStreamTailIndex: unexpectedCall,
};

test("Zalo webhook authenticates, isolates conversations, and dispatches only approved messages", async (t) => {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  process.env.ZALO_BOT_TOKEN = "test-token";
  process.env.ZALO_WEBHOOK_SECRET_TOKEN = "test-secret";
  process.env.ZALO_ALLOWED_USER_IDS = "owner";
  process.env.ZALO_ALLOWED_CHAT_IDS = "group-1";
  const route = channel.routes[0]!;
  if (route.transport === "websocket") throw new Error("Expected HTTP webhook");
  const addresses: string[] = [];
  const messages: (string | UserContent)[] = [];
  type State = { chatId: string };
  const args: RouteHandlerArgs<State> = {
    from(address) {
      addresses.push(address);
      return { async send(message, options) {
        messages.push(message);
        assert.equal(options.auth?.authenticator, "zalo-webhook");
        return session;
      }, respond: unexpectedCall, cancel: unexpectedCall, compact: unexpectedCall,
      clear: unexpectedCall, reset: unexpectedCall };
    },
    waitUntil: unexpectedCall, resolveSession: unexpectedCall, attachSession: unexpectedCall,
    to: unexpectedCall, params: {}, requestIp: null, describe: unexpectedCall,
    listSkillFiles: unexpectedCall, readSkill: unexpectedCall, invokeTool: unexpectedCall,
  };
  async function send(user: string, chatId = user, chatType = "PRIVATE", secret = "test-secret", event = "message.text.received", wrapped = false, media = {}) {
    const payload = {
      event_name: event, message: { from: { id: user, is_bot: false }, chat: { id: chatId, chat_type: chatType },
        message_id: "message-1", text: "hello", ...media },
    };
    return route.handler(new Request("http://localhost/webhooks/zalo", { method: "POST",
      headers: { "x-bot-api-secret-token": secret }, body: JSON.stringify(wrapped ? { ok: true, result: payload } : payload),
    }), args);
  }
  const denied = await send("owner", "owner", "PRIVATE", "wrong");
  assert.ok(denied instanceof Response);
  assert.equal(denied.status, 403);
  await send("outsider");
  await send("owner", "unapproved-group", "GROUP");
  await send("owner", "owner", "PRIVATE", "test-secret", "message.unsupported.received");
  assert.equal(addresses.length, 0);
  await send("owner", "owner", "PRIVATE", "test-secret", "message.text.received", true);
  await send("owner");
  await send("outsider", "group-1", "GROUP");
  assert.deepEqual(addresses, ["PRIVATE:owner", "PRIVATE:owner", "GROUP:group-1"]);
  assert.equal(messages.length, 3);
  const probe = await route.handler(new Request("http://localhost/webhooks/zalo", {
    method: "POST", headers: { "x-bot-api-secret-token": "test-secret" }, body: "{}",
  }), args);
  assert.ok(probe instanceof Response);
  assert.equal(probe.status, 200);
  const verification = { event_name: "webhook.test", message: {
    date: 1791848592, message_id: "webhook-test",
    text: "Zalo Bot Platform webhook test - please respond with HTTP 200",
  } };
  for (const [secret, status] of [["test-secret", 200], ["wrong", 403]] as const) {
    const response: Response = await route.handler(new Request("http://localhost/webhooks/zalo", {
      method: "POST", headers: { "x-bot-api-secret-token": secret },
      body: JSON.stringify(verification),
    }), args);
    assert.ok(response instanceof Response);
    assert.equal(response.status, status);
  }
  assert.equal(addresses.length, 3);
  const imageResponse = await send("owner", "owner", "PRIVATE", "test-secret", "message.image.received", false, {
    photo_url: "https://example.com/live-photo.jpg", caption: "", message_type: "CHAT_PHOTO",
  });
  assert.ok(imageResponse instanceof Response);
  assert.equal(imageResponse.status, 200);
  assert.deepEqual(messages[3], [
    { type: "text", text: "Describe this image briefly and ask what I need help with." },
    { type: "image", image: new URL("https://example.com/live-photo.jpg") },
  ]);
  assert.equal(addresses[3], "PRIVATE:owner");
});
