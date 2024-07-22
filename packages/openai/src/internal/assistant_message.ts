import { generateSchema } from "@anatine/zod-openapi";
import { AssistantStream } from "openai/lib/AssistantStream";
import { FunctionParameters } from "openai/resources";
import { AssistantTool } from "openai/resources/beta/assistants";
import { MessageContentPartParam } from "openai/resources/beta/threads/messages";
import { RunCreateParams } from "openai/resources/beta/threads/runs/runs";

import { UserMessage } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { assistantId, threads } from "./openai";

export const endOfThinking = "---- END OF THINKING ---";

export async function assistantSendMessage(
  ctx: AppContext,
  threadId: string,
  { imageUrl, text: textWithoutMetadata }: UserMessage
): Promise<AssistantStream> {
  const text = `---- METADATA ----
The current time is ${new Date().toISOString()}.
---- END OF METADATA ---

${textWithoutMetadata}
`;
  const message: RunCreateParams.AdditionalMessage = {
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
  };
  await ctx.pushMessage({ role: "user", threadId, text });

  const instructions = `Your name is Bubby.
You are a personal assistant bot. Ensure efficient and user-friendly interaction, focusing on simplicity and clarity in communication.
You provide concise and direct answers. Maintain a straightforward and easy-going conversation tone. Keep responses brief, typically in short sentences.

User message format:
1. Each user message starts with a METADATA section, including the current time
2. The actual user message follows the METADATA section.

Bot message format:
1. Each bot message starts with a THINKING section
2. The THINKING section re-count the different topics in the thread
3. The section ends with '${endOfThinking}'
4. The actual bot message follows the THINKING section

Thread management:
1. Before EVERY response, you MUST evaluate if a new thread is needed.
2. Use the new_thread tool when there are more than one distinct questions or tasks.
3. For ambiguous cases, ask the user to confirm whether they want to start another thread or continue the current one.

Example:
User: What's the weather like today?
Bubby: It's sunny and 24°C today.
User: How about tomorrow?
Bubby: Tomorrow will be cloudy with a high of 21°C.
User: Can you help me with a recipe?
Bubby uses the new_thread tool
Bubby: Certainly! What kind of recipe are you looking for?

Remember, your context is limited, so managing threads efficiently is crucial.
ALWAYS evaluate if a new thread is needed before responding. If in doubt, ask the user.
`;
  return threads.runs.stream(threadId, {
    assistant_id: assistantId,
    instructions,
    additional_messages: [message],
    model: "gpt-4o-mini",
    tools: [
      { type: "code_interpreter" },
      { type: "file_search" },
      ...ctx.tools.map<AssistantTool>((tool) => {
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
