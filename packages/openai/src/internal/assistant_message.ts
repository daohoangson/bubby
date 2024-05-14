import { generateSchema } from "@anatine/zod-openapi";
import { FunctionParameters } from "openai/resources";
import { AssistantTool } from "openai/resources/beta/assistants";
import { Message } from "openai/resources/beta/threads/messages";

import { assistantId, threads } from "./openai";
import { Tool } from "@bubby/core/interfaces/ai";

export async function assistantGetNewMessages(
  threadId: string,
  runId: string,
  existingMessageIds: string[]
): Promise<Message[]> {
  const { data } = await threads.messages.list(threadId, {
    order: "desc",
    run_id: runId,
  });
  return data.filter(
    (message) => existingMessageIds.includes(message.id) === false
  );
}

export async function assistantSendMessage(
  threadId: string,
  content: string,
  tools: Tool<any>[]
): Promise<{ runId: string }> {
  await threads.messages.create(threadId, { content, role: "user" });

  const instructions = `Your name is Bubby.
You are a personal assistant bot. Ensure efficient and user-friendly interaction, focusing on simplicity and clarity in communication.
You provide concise and direct answers. Maintain a straightforward and easy-going conversation tone. Keep responses brief, typically in short sentences.
You can only reply to text or photo messages.`;
  const run = await threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions,
    model: "gpt-4o",
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

  return { runId: run.id };
}
