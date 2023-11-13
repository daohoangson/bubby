import { generateSchema } from "@anatine/zod-openapi";
import { FunctionParameters } from "openai/resources";
import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { z } from "zod";

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
