import { Reply } from "../../abstracts/chat";
import { assistantId, threads } from "./openai";

export async function assistantGetNewMessages(
  threadId: string,
  runId: string
): Promise<Reply[]> {
  const replies: Reply[] = [];

  const list = await threads.messages.list(threadId);
  for (const threadMessage of list.data) {
    if (threadMessage.run_id === runId) {
      for (const messageContent of threadMessage.content) {
        if (messageContent.type === "text") {
          const markdown = messageContent.text.value;
          replies.push({ markdown });
        }
      }
    }
  }

  return replies;
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
