import {
  ChatCompletionCreateParamsNonStreaming,
  ImageGenerateParams,
} from "openai/resources";
import { openai } from "./openai";

export async function visionAnalyzeImage(
  prompt: string,
  url: string,
  temperature: number
): Promise<string> {
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

export async function visionGenerateImage(
  prompt: string,
  size: ImageGenerateParams["size"]
): Promise<{ caption: string; url: string } | undefined> {
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
      caption: image.revised_prompt ?? prompt,
      url: image.url!,
    };
  }
}
