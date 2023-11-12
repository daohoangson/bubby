import { Reply } from "../../abstracts/chat";
import { assistantId, threads } from "./openai";

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
          yield { markdown };
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
  const run = await threads.runs.create(threadId, {
    assistant_id: assistantId,
  });

  return { runId: run.id };
}
