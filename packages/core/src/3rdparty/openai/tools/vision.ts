import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";

export const analyzeImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Analyze an image.",
    name: "analyze_image",
    parameters: {
      type: "object",
      properties: {
        image_url: {
          type: "string",
          description: "The image URL.",
        },
        prompt: {
          type: "string",
          description: "The prompt to ask the Vision AI model to analyze.",
        },
        temperature: {
          type: "number",
          description:
            "What sampling temperature to use, between 0 and 2. " +
            "Higher values like 0.8 will make the output more random, " +
            "while lower values like 0.2 will make it more focused and deterministic.",
        },
      },
      required: ["image_url", "prompt", "temperature"],
    },
  },
  type: "function",
};

export const generateImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Generate an image.",
    name: "generate_image",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to ask the Vision AI model to generate.",
        },
        size: {
          type: "string",
          description: "The size of the generated images.",
          oneOf: [
            { const: "1024x1024" },
            { const: "1792x1024" },
            { const: "1024x1792" },
          ],
        },
      },
      required: ["prompt", "size"],
    },
  },
  type: "function",
};
