import { z } from "zod";

import { Tool } from "@bubby/core/interfaces/ai";
import { visionGenerateImage } from "@bubby/openai";

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
