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

export const replyWithImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Reply with an image.",
    name: "reply_with_image",
    parameters: {
      type: "object",
      properties: {
        caption: {
          type: "string",
          description: "The image caption.",
        },
        image_url: {
          type: "string",
          description: "The image URL.",
        },
      },
      required: ["image_url"],
    },
  },
  type: "function",
};
