import { generateSchema } from "@anatine/zod-openapi";
import { AssistantStream } from "openai/lib/AssistantStream";
import { FunctionParameters } from "openai/resources";
import { AssistantTool } from "openai/resources/beta/assistants";
import { MessageContentPartParam } from "openai/resources/beta/threads/messages";

import { AgentMessage, Tool } from "@bubby/core/interfaces/ai";
import { assistantId, threads } from "./openai";

export async function assistantSendMessage(
  threadId: string,
  { imageUrl, text }: AgentMessage,
  tools: Tool<any>[]
): Promise<AssistantStream> {
  await threads.messages.create(threadId, {
    content: [
      {
        type: "text",
        text,
      },
      ...(typeof imageUrl === "string"
        ? [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            } satisfies MessageContentPartParam,
          ]
        : []),
    ],
    role: "user",
  });

  const instructions = `Your name is Bubby.
You are a personal assistant bot. Ensure efficient and user-friendly interaction, focusing on simplicity and clarity in communication.
You provide concise and direct answers. Maintain a straightforward and easy-going conversation tone. Keep responses brief, typically in short sentences.
You can only reply to text or photo messages.`;
  return threads.runs.stream(threadId, {
    assistant_id: assistantId,
    instructions,
    model: "gpt-4o-mini",
    tools: [
      { type: "code_interpreter" },
      { type: "file_search" },
      ...tools.map<AssistantTool>((tool) => {
        return {
          function: {
            description: tool.description,
            name: tool.name,
            parameters: generateSchema(
              tool.parametersSchema
            ) as FunctionParameters,
          },
          type: "function",
        };
      }),
    ],
  });
}
