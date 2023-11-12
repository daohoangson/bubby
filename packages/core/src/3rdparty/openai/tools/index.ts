import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { newThread } from "./new_thread";

export const functions = { newThread };

export const tools: RunCreateParams["tools"] = [
  { type: "code_interpreter" },
  { type: "retrieval" },
  ...Object.values(functions),
];
