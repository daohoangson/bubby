import { ThreadMessage } from "openai/resources/beta/threads/messages/messages";

import { assistantId, threads } from "./internal/openai";
import { analyzeImage, generateImage } from "./tools/image";
import { newThread } from "./tools/ops";
import { overwriteMemory } from "./tools/memory";

export async function assistantGetNewMessages(
  threadId: string,
  runId: string,
  existingMessageIds: string[]
): Promise<ThreadMessage[]> {
  const list = await threads.messages.list(threadId);
  return [...list.data]
    .reverse()
    .filter(
      (message) =>
        message.run_id === runId &&
        existingMessageIds.includes(message.id) === false
    );
}

export async function assistantSendMessage(
  threadId: string,
  content: string
): Promise<{ runId: string }> {
  await threads.messages.create(threadId, { content, role: "user" });

  const instructions = `Your name is Bubby.
You are a personal assistant bot. Ensure efficient and user-friendly interaction, focusing on simplicity and clarity in communication.
You provide concise and direct answers. Maintain a straightforward and easy-going conversation tone. Keep responses brief, typically in short sentences.
You can only reply to text or photo messages.`;
  const run = await threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions,
    model: "gpt-4-1106-preview",
    tools: [
      { type: "code_interpreter" },
      { type: "retrieval" },
      // image
      analyzeImage,
      generateImage,
      // memory
      overwriteMemory,
      // ops
      newThread,
    ],
  });

  return { runId: run.id };
}
