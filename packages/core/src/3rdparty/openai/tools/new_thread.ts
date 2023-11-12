import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";

export const newThread: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Discard the recent messages and start a new thread.",
    name: "new_thread",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  type: "function",
};
