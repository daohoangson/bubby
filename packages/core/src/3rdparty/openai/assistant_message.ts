import { Reply } from "../../abstracts/chat";
import { assistantId, threads } from "./openai";
import { analyzeImage, generateImage } from "./tools/image";
import { newThread, replyWithImage } from "./tools/ops";

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
You are a Telegram personal assistant bot.
You answer to the point, with short sentences. You keep the conversation light and simple.
Telegram is a text based chat app, you must use ${replyWithImage.function.name} function to send image.`;
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
      replyWithImage,
    ],
  });

  return { runId: run.id };
}
