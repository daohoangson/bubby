import { ResponseInputItem } from "openai/resources/responses/responses";

import { AgentMessage, Tool } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { buildTools, responses, responseStreamParams } from "./openai";

type StreamUserMessageInput = {
  ctx: AppContext;
  previousResponseId: string | undefined;
  message: AgentMessage;
  tools: Tool<any>[];
};

export async function streamUserMessage({
  ctx: { chat, kv, user },
  previousResponseId,
  message: { imageUrl, text },
  tools,
}: StreamUserMessageInput) {
  const input: ResponseInputItem[] = [];
  if (typeof previousResponseId === "undefined") {
    input.push({
      role: "system",
      content: `Your name is Bubby.
You are a personal assistant bot. Ensure efficient and user-friendly interaction, focusing on simplicity and clarity in communication.
You provide concise and direct answers. Maintain a straightforward and easy-going conversation tone. Keep responses brief, typically in short sentences.
You can only reply to text or photo messages.`,
    });
  }

  const userMessage: ResponseInputItem.Message = { role: "user", content: [] };

  if (typeof previousResponseId === "undefined") {
    const memory =
      (await kv.get(chat.getChannelId(), "memory")) ??
      `User's name: ${user.getUserName()}\nUser's date of birth: Unknown\nUser's relationship status: Unknown`;
    userMessage.content.push({
      type: "input_text",
      text: `---- START OF MEMORY ----\n${memory}\n---- END OF MEMORY ----`,
    });
  }

  userMessage.content.push({ type: "input_text", text });
  if (typeof imageUrl === "string") {
    userMessage.content.push({
      type: "input_image",
      detail: "auto",
      image_url: imageUrl,
    });
  }
  input.push(userMessage);

  return responses.stream({
    ...responseStreamParams,
    input,
    previous_response_id: previousResponseId,
    tools: buildTools(tools),
  });
}
