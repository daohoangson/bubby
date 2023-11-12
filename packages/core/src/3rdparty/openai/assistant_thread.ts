import { AssistantError } from "../../abstracts/assistant";
import { Chat } from "../../abstracts/chat";
import { KV } from "../../abstracts/kv";
import { threads } from "./openai";

export type AssistantThreadInput = {
  chat: Chat;
  kv: KV;
};

function assistantThreadKvKey({ chat }: AssistantThreadInput): string {
  return `thread-id-v3-${chat.getChatId()}`;
}

export async function assistantThreadIdInsert(
  input: AssistantThreadInput
): Promise<string> {
  const kvKey = assistantThreadKvKey(input);
  const threadId = (await threads.create({})).id;
  await input.kv.set(kvKey, threadId);
  console.log({ kvKey, newThreadId: threadId });
  return threadId;
}

export async function assistantThreadIdUpsert(
  input: AssistantThreadInput
): Promise<string> {
  const kvKey = assistantThreadKvKey(input);
  const threadId = await input.kv.get(kvKey);
  if (typeof threadId === "string") {
    return threadId;
  }

  const userId = input.chat.getUserId();
  if (userId !== "552046506") {
    // https://t.me/daohoangson
    throw new AssistantError(`Do I know you? #${userId}`);
  }

  return assistantThreadIdInsert(input);
}
