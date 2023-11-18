import { generateSchema } from "@anatine/zod-openapi";
import { FunctionParameters } from "openai/resources";
import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";
import { z } from "zod";

export const analyzeImageParameters = z.object({
  image_url: z.string({
    description: "The image URL.",
  }),
  prompt: z.string({
    description: "The prompt to ask the Vision AI model to analyze.",
  }),
  temperature: z.number({
    description:
      "What sampling temperature to use, between 0 and 2. " +
      "Higher values like 0.8 will make the output more random, " +
      "while lower values like 0.2 will make it more focused and deterministic.",
  }),
});

export const analyzeImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Analyze an image.",
    name: "analyze_image",
    parameters: generateSchema(analyzeImageParameters) as FunctionParameters,
  },
  type: "function",
};

export const generateImageParameters = z.object({
  prompt: z.string({
    description: "The prompt to ask the Vision AI model to generate.",
  }),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"], {
    description: "The size of the generated images.",
  }),
});

export const generateImage: RunCreateParams.AssistantToolsFunction = {
  function: {
    description: "Generate an image.",
    name: "generate_image",
    parameters: generateSchema(generateImageParameters) as FunctionParameters,
  },
  type: "function",
};
