import { AppContext } from "@bubby/core/interfaces/app";
import { threads } from "./internal/openai";

export async function assistantThreadIdInsert({
  chat,
  kv,
  user,
}: AppContext): Promise<string> {
  const memory =
    (await kv.get(chat.getChannelId(), "memory")) ??
    `User's name: ${user.getUserName()}\nUser's date of birth: Unknown\nUser's relationship status: Unknown`;
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
  ctx: AppContext
): Promise<string> {
  const { chat, kv, user } = ctx;
  const threadId = await kv.get(chat.getChannelId(), "assistant-thread-id");
  if (typeof threadId === "string") {
    return threadId;
  }

  if (!user.isAdmin()) {
    throw new Error(`Do I know you? #${user.getUserId()}`);
  }

  return assistantThreadIdInsert(ctx);
}
