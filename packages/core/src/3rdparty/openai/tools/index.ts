import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";

import { analyzeImage, generateImage } from "./image";
import { newThread } from "./new_thread";

export const functions = {
  // vision
  analyzeImage,
  generateImage,
  // ops
  newThread,
};

export const tools: RunCreateParams["tools"] = [
  { type: "code_interpreter" },
  { type: "retrieval" },
  ...Object.values(functions),
];
