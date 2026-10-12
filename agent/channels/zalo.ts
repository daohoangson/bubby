import { defineChannel, POST } from "eve/channels";
import { z } from "zod";
import { postZaloText, showZaloTyping } from "../../lib/zalo-api.ts";
import { canChatOnZalo, verifyZaloWebhook, zaloAuth, zaloContent, zaloUpdateSchema } from "../../lib/zalo-inbound.ts";

type ZaloState = { chatId: string };

export default defineChannel<ZaloState, { state: ZaloState }>({
  // Keep follow-ups in order while the current turn is running.
  turnPolicy: "queue",
  uploadPolicy: { maxBytes: 20_000_000, allowedMediaTypes: ["image/*"] },
  state: { chatId: "" },
  context(state) { return { state }; },
  routes: [POST("/webhooks/zalo", async (request, { from }) => {
    if (!process.env.ZALO_BOT_TOKEN) return new Response("Zalo is not configured", { status: 503 });
    if (!verifyZaloWebhook(request, process.env.ZALO_WEBHOOK_SECRET_TOKEN)) {
      return new Response("Unauthorized", { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const update = zaloUpdateSchema.safeParse(body);
    // Zalo sends authenticated verification probes with no documented message shape.
    if (!update.success) {
      const probe = z.object({ message: z.json().optional(),
        result: z.object({ message: z.json().optional() }).optional() }).safeParse(body);
      return new Response("ok", { status: probe.success && !probe.data.message && !probe.data.result?.message ? 200 : 400 });
    }
    const { event_name: event, message } = update.data;
    if (!message || !canChatOnZalo(message)) return new Response("ok");
    const content = zaloContent(event, message);
    if (!content) return new Response("ok");
    const session = await from(`${message.chat.chat_type}:${message.chat.id}`).send(content, {
      auth: zaloAuth(message),
      state: { chatId: message.chat.id },
    });
    return Response.json({ ok: true, sessionId: session.id });
  })],
  events: {
    async "turn.started"(_event, channel) { await showZaloTyping(channel.state.chatId); },
    async "actions.requested"(_event, channel) { await showZaloTyping(channel.state.chatId); },
    async "message.completed"(event, channel) {
      if (event.finishReason !== "tool-calls" && event.message) await postZaloText(channel.state.chatId, event.message);
    },
    async "turn.failed"(event, channel) {
      if (!event.terminal) await postZaloText(channel.state.chatId, "I couldn't complete your request. Please try again.");
    },
    async "session.failed"(_event, channel) {
      await postZaloText(channel.state.chatId, "This conversation couldn't recover from an error. Please contact the bot owner.");
    },
  },
});
