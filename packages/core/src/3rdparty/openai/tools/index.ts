import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";

import { analyzeImage, generateImage } from "./image";
import { newThread, replyWithImage } from "./ops";

export const functions = {
  // vision
  analyzeImage,
  generateImage,
  // ops
  newThread,
  replyWithImage,
};

export const tools: RunCreateParams["tools"] = [
  { type: "code_interpreter" },
  { type: "retrieval" },
  ...Object.values(functions),
];
