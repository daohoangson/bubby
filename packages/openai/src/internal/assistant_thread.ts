import { ThreadCreateParams } from "openai/resources/beta/threads/threads";

import { AppContext } from "@bubby/core/interfaces/app";
import { threads } from "./openai";

export async function assistantThreadIdInsert(
  ctx: AppContext
): Promise<string> {
  const { chat, kv } = ctx;

  const messages: ThreadCreateParams.Message[] = [];
  for (const { role, text } of ctx.messages) {
    // populate new thread with recent messages
    messages.push({ role, content: text });
  }

  const memory = await kv.get(chat.getChannelId(), "memory");
  if (typeof memory === "string") {
    messages.push({
      content: `---- START OF MEMORY ----\n${memory}\n---- END OF MEMORY ----`,
      role: "user",
    });
  }

  const threadId = (await threads.create({ messages })).id;
  await kv.set(chat.getChannelId(), "assistant-thread-id", threadId);

  ctx.onNewMessage(async ({ role, text, threadId: newMessageThreadId }) => {
    if (newMessageThreadId !== threadId) {
      // sync new messages to our thread
      await threads.messages.create(threadId, { content: text, role });
    }
  });

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
