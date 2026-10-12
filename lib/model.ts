import { createOpenAI } from "@ai-sdk/openai";

type ModelEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENAI_API?: string;
};

export function createModel(env: ModelEnv) {
  const api = env.OPENAI_API || "responses";
  if (api !== "responses" && api !== "chat") {
    throw new Error("OPENAI_API must be responses or chat");
  }
  const provider = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined,
  });
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  return api === "chat" ? provider.chat(model) : provider.responses(model);
}
