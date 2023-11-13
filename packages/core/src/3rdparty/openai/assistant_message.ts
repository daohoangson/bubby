import { Reply } from "../../abstracts/chat";
import { assistantId, threads } from "./openai";
import { analyzeImage, generateImage } from "./tools/image";
import { newThread } from "./tools/ops";

export async function* assistantGetNewMessages(
  threadId: string,
  runId: string
): AsyncGenerator<Reply> {
  const list = await threads.messages.list(threadId);
  const threadMessages = [...list.data].reverse();
  for (const threadMessage of threadMessages) {
    if (threadMessage.run_id === runId) {
      console.log(JSON.stringify(threadMessage, null, 2));
      for (const messageContent of threadMessage.content) {
        if (messageContent.type === "text") {
          const markdown = messageContent.text.value;
          yield { type: "markdown", markdown };
        }
      }
    }
  }
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
      // vision
      analyzeImage,
      generateImage,
      // ops
      newThread,
    ],
  });

  return { runId: run.id };
}