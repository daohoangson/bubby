import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { generateText } from "ai";
import { createModel } from "./model.ts";

for (const api of ["responses", "chat"] as const) {
  test(`custom provider sends ${api} requests to the configured endpoint`, async () => {
    let requestPath: string | undefined;
    let authorization: string | undefined;
    let requestBody: { model?: string; store?: boolean; input?: object[] } = {};
    const server = createServer(async (req, res) => {
      requestPath = req.url;
      authorization = req.headers.authorization;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      requestBody = JSON.parse(Buffer.concat(chunks).toString());
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(api === "responses" ? {
        id: "resp_test", object: "response", created_at: 1, status: "completed", model: "custom-model",
        output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed",
          content: [{ type: "output_text", text: "Hello Bubby", annotations: [] }] }],
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      } : {
        id: "chatcmpl_test", object: "chat.completion", created: 1, model: "custom-model",
        choices: [{ index: 0, message: { role: "assistant", content: "Hello Bubby" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const model = createModel({ OPENAI_API: api, OPENAI_MODEL: "custom-model", OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` });
      const providerOptions = { openai: { store: false } };
      const result = await generateText({ model, prompt: "Hello", maxRetries: 0, providerOptions });
      assert.equal(result.text, "Hello Bubby");
      assert.equal(requestPath, api === "responses" ? "/v1/responses" : "/v1/chat/completions");
      assert.equal(authorization, "Bearer test-key");
      assert.equal(requestBody.model, "custom-model");
      if (api === "responses") {
        await generateText({ model, maxRetries: 0, providerOptions, messages: [
          { role: "user", content: "Hello" }, ...result.response.messages,
          { role: "user", content: "What did you say?" },
        ] });
        assert.equal(requestBody.store, false);
        assert.ok(!JSON.stringify(requestBody.input).includes("item_reference"));
        assert.ok(JSON.stringify(requestBody.input).includes("Hello Bubby"));
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
}

test("invalid API format fails before making a request", () => {
  assert.throws(() => createModel({ OPENAI_API: "invalid" }), /OPENAI_API/);
});

test("Gateway uses Eve's native model ID without custom provider configuration", () => {
  assert.equal(createModel({ AI_GATEWAY_MODEL: " anthropic/claude-haiku-5.5 ", OPENAI_API: "invalid" }),
    "anthropic/claude-haiku-5.5");
  assert.equal(typeof createModel({ AI_GATEWAY_MODEL: "  ", OPENAI_MODEL: "custom-model" }), "object");
});
