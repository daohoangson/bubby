import { AssistantError } from "../../abstracts/assistant";
import { Chat } from "../../abstracts/chat";
import { KV } from "../../abstracts/kv";
import { threads } from "./openai";

export type AssistantThreadInput = {
  chat: Chat;
  kv: KV;
};

export async function assistantThreadIdInsert(
  input: AssistantThreadInput
): Promise<string> {
  const { chat, kv } = input;
  const memory =
    (await kv.get(chat.getChannelId(), "memory")) ??
    `User's name: ${chat.getUserName()}\nUser's date of birth: Unknown\nUser's relationship status: Unknown`;
  const threadId = (
    await threads.create({
      messages: [
        {
          content: `---- START OF MEMORY ----\n${memory}\n---- END OF MEMORY ----`,
          role: "user",
        },
      ],
    })
  ).id;
  await kv.set(chat.getChannelId(), "assistant-thread-id", threadId);
  return threadId;
}

export async function assistantThreadIdUpsert(
  input: AssistantThreadInput
): Promise<string> {
  const threadId = await input.kv.get(
    input.chat.getChannelId(),
    "assistant-thread-id"
  );
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
