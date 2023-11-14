import { generateSchema } from "@anatine/zod-openapi";
import { FunctionParameters } from "openai/resources";
import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { z } from "zod";

export const overwriteMemoryParameters = z.object({
  memory: z.string({
    description: "New memory to overwrite the existing one.",
  }),
});

export const overwriteMemory: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Overwrite memory.",
    name: "overwrite_memory",
    parameters: generateSchema(overwriteMemoryParameters) as FunctionParameters,
  },
  type: "function",
};
