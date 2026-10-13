import { defineAgent } from "eve";
import { createModel } from "../lib/model.ts";

const model = createModel(process.env);

export default defineAgent({
  build: { externalDependencies: ["just-bash", "microsandbox"] },
  defaultTools: false,
  model,
  // Keep history in Eve; compatible endpoints may not support item_reference.
  modelOptions: typeof model === "string" ? undefined : { providerOptions: { openai: { store: false } } },
});
