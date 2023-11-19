import {
  ChatCompletionCreateParamsNonStreaming,
  ImageGenerateParams,
} from "openai/resources";

import { AppContext } from "@bubby/core/interfaces/app";
import { openai } from "./openai";

type VisionAnalyzeImageInput = {
  ctx: AppContext;
  image_url: string;
  prompt: string;
  temperature: number;
};

export type GeneratedImage = { revised_prompt?: string; url: string };

export async function visionAnalyzeImage({
  ctx: { chat },
  image_url,
  prompt,
  temperature,
}: VisionAnalyzeImageInput): Promise<string> {
  let url = image_url;

  const unmaskedUrl = await chat.unmaskFileUrl(image_url);
  if (typeof unmaskedUrl === "string") {
    url = unmaskedUrl;
  }

  const body: ChatCompletionCreateParamsNonStreaming = {
    messages: [
      {
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url } },
        ],
        role: "user",
      },
    ],
    model: "gpt-4-vision-preview",
    max_tokens: 1024,
    temperature,
  };
  console.log(JSON.stringify(body, null, 2));
  const completion = await openai.chat.completions.create(body);
  console.log(JSON.stringify(completion, null, 2));
  return completion.choices[0].message.content ?? "";
}

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
