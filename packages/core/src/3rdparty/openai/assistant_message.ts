import { Reply } from "../../abstracts/chat";
import { assistantId, threads } from "./openai";
import { tools } from "./tools";

export async function* assistantGetNewMessages(
  threadId: string,
  runId: string
): AsyncGenerator<Reply> {
  const list = await threads.messages.list(threadId);
  for (const threadMessage of list.data) {
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

  const instructions = `Your name is Dog.
You are a Telegram personal assistant bot.
You make people happy by answering chat messages.
You answer to the point, with short sentences. You keep the conversation light and simple.`;
  const run = await threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions,
    model: "gpt-4-1106-preview",
    tools,
  });

  return { runId: run.id };
}
