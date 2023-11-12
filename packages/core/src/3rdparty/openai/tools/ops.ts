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

export const replyWithImageParameters = z.object({
  caption: z.string({
    description: "The image caption.",
  }),
  image_url: z.string({
    description: "The image URL.",
  }),
});

export const replyWithImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Reply with an image.",
    name: "reply_with_image",
    parameters: generateSchema(replyWithImageParameters) as FunctionParameters,
  },
  type: "function",
};
