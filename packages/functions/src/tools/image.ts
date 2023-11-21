import { z } from "zod";

import { Tool } from "@bubby/core/interfaces/ai";
import { visionAnalyzeImage, visionGenerateImage } from "@bubby/openai";

const analyzeImageParameters = z.object({
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

export const analyzeImage: Tool<z.infer<typeof analyzeImageParameters>> = {
  description: "Analyze an image.",
  name: "analyze_image",
  handler: async ({ ctx, parameters }) => {
    ctx.chat.reply({ type: "system", system: "🚨 Analyzing..." });
    return visionAnalyzeImage({ ctx, ...parameters });
  },
  parametersSchema: analyzeImageParameters,
};

const generateImageParameters = z.object({
  prompt: z.string({
    description: "The prompt to ask the Vision AI model to generate.",
  }),
  size: z.enum(["1024x1024", "1792x1024", "1024x1792"], {
    description: "The size of the generated images.",
  }),
});

export const generateImage: Tool<z.infer<typeof generateImageParameters>> = {
  description: "Generate an image.",
  name: "generate_image",
  handler: async ({ ctx, parameters }) => {
    const { chat } = ctx;
    chat.reply({ type: "system", system: "🚨 Generating..." });
    const image = await visionGenerateImage(parameters);
    if (typeof image === "undefined") {
      return false;
    }

    const { revised_prompt, url } = image;
    chat.reply({ type: "system", system: "🚨 Uploading..." });
    await chat.reply({
      type: "photo",
      url,
      caption: revised_prompt ?? parameters.prompt,
    });

    return {
      success: true,
      description:
        typeof revised_prompt === "string"
          ? `Image has been generated with a revised prompt: ${revised_prompt}\n\nThe image and revised prompt have been sent to user successfully.`
          : `Image has been generated and sent to user successfully.`,
    };
  },
  parametersSchema: generateImageParameters,
};
