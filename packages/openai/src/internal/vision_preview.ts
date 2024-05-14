import { ImageGenerateParams } from "openai/resources";

import { openai } from "./openai";

export type GeneratedImage = { revised_prompt?: string; url: string };

export async function visionGenerateImage({
  prompt,
  size,
}: {
  prompt: string;
  size: ImageGenerateParams["size"];
}): Promise<GeneratedImage | undefined> {
  const body: ImageGenerateParams = {
    prompt,
    model: "dall-e-3",
    response_format: "url",
    size,
  };
  console.log(JSON.stringify(body, null, 2));
  const completion = await openai.images.generate(body);
  console.log(JSON.stringify(completion, null, 2));
  const image = completion.data[0];
  if (typeof image === "object") {
    return {
      revised_prompt: image.revised_prompt,
      url: image.url!,
    };
  }
}
