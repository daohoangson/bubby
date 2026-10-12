import assert from "node:assert/strict";
import test from "node:test";
import { defineAgent } from "eve";
import { createModel } from "../lib/model.ts";
// These tests deliberately exercise the pinned Eve patch through its internals.
import { ContextContainer } from "../node_modules/eve/dist/src/context/container.js";
import { StaticModelReferenceKey, LiveStepDynamicModelSelectionKey } from "../node_modules/eve/dist/src/context/keys.js";
import { normalizeDynamicSubagentAgentConfig } from "../node_modules/eve/dist/src/runtime/subagents/dynamic-agent-config.js";
import { resolveRuntimeModelReference } from "../node_modules/eve/dist/src/runtime/agent/resolve-model.js";

test("editor inheritance survives JSON checkpoints and resolves the parent's provider across node scopes", async () => {
  const state = new ContextContainer();
  const providerOptions = { openai: { store: false } };
  const source = { sourceKind: "module", logicalPath: "agent.ts", sourceId: "agent.ts" } as const;
  state.set(StaticModelReferenceKey, {
    id: "custom-model", source, providerOptions, contextWindowTokens: 100_000,
  });
  const child = await normalizeDynamicSubagentAgentConfig({ name: "editor", state,
    value: defineAgent({ description: "Edit source", model: "eve:inherit-parent" }) });
  const restored: typeof child.model = JSON.parse(JSON.stringify(child.model));
  assert.equal(restored.sourceNodeId, "__root__");
  assert.deepEqual(restored.providerOptions, providerOptions);
  assert.ok(!JSON.stringify(restored).includes("test-key"));
  const model = createModel({ OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "http://127.0.0.1:1/v1", OPENAI_MODEL: "custom-model" });
  const resolved = await resolveRuntimeModelReference(restored, { nodeId: "editor", moduleMap: { nodes: {
    __root__: { modules: { "agent.ts": { default: defineAgent({ model }) } } },
    editor: { modules: {} },
  } } });
  assert.equal(resolved, model);

  // Nested delegation preserves the original source scope.
  state.set(StaticModelReferenceKey, restored);
  const nested = await normalizeDynamicSubagentAgentConfig({ name: "nested", state,
    value: defineAgent({ description: "Edit source", model: "eve:inherit-parent" }) });
  assert.deepEqual(nested.model, restored);
});

test("inheritance rejects absent or ephemeral models and preserves explicit model overrides", async () => {
  const state = new ContextContainer();
  const value = defineAgent({ description: "Edit source", model: "eve:inherit-parent" });
  state.set(StaticModelReferenceKey, null);
  await assert.rejects(normalizeDynamicSubagentAgentConfig({ name: "editor", state, value }), /durable model reference/);
  state.setVirtualContext(LiveStepDynamicModelSelectionKey, {
    reference: { id: "custom-model" }, model: createModel({ OPENAI_MODEL: "custom-model" }),
  });
  await assert.rejects(normalizeDynamicSubagentAgentConfig({ name: "editor", state, value }), /durable model reference/);
  state.clearVirtualContext();
  const explicit = await normalizeDynamicSubagentAgentConfig({ name: "editor", state,
    value: defineAgent({ description: "Edit source", model: "openai/gpt-6-luna", modelContextWindowTokens: 100_000 }) });
  assert.equal(explicit.model.id, "openai/gpt-6-luna");
  assert.equal(explicit.model.source, undefined);
});
