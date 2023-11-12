import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { newThread } from "./new_thread";
import { analyzeImage } from "./vision";

export const functions = {
  // ops
  newThread,
  // vision
  analyzeImage,
};

export const tools: RunCreateParams["tools"] = [
  { type: "code_interpreter" },
  { type: "retrieval" },
  ...Object.values(functions),
];
