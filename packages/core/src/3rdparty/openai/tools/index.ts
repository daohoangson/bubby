import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { newThread } from "./new_thread";
import { analyzeImage, generateImage } from "./vision";

export const functions = {
  // ops
  newThread,
  // vision
  analyzeImage,
  generateImage,
};

export const tools: RunCreateParams["tools"] = [
  { type: "code_interpreter" },
  { type: "retrieval" },
  ...Object.values(functions),
];
