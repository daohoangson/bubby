import { defineAgent } from "eve";
import { createModel } from "../lib/model.ts";

export default defineAgent({
  build: { externalDependencies: ["just-bash", "microsandbox"] },
  defaultTools: false,
  model: createModel(process.env),
  // Keep history in Eve; compatible endpoints may not support item_reference.
  modelOptions: { providerOptions: { openai: { store: false } } },
});
