import { kv } from "@vercel/kv";
import { Context } from "telegraf";

import { threads } from "./config";

function assistantThreadKvKey(ctx: Context): string {
  return `thread-id-v3-${ctx.chat?.id}`;
}

export async function assistantThreadIdInsert(ctx: Context): Promise<string> {
  const kvKey = assistantThreadKvKey(ctx);
  const threadId = (await threads.create({})).id;
  await kv.set<string>(kvKey, threadId);
  console.log({ kvKey, threadId });
  return threadId;
}

export async function assistantThreadIdUpsert(ctx: Context): Promise<string> {
  const kvKey = assistantThreadKvKey(ctx);
  const existingThreadId = await kv.get<string>(kvKey);
  if (typeof existingThreadId === "string") {
    return existingThreadId;
  }

  if (ctx.from?.id !== 552046506) {
    // https://t.me/daohoangson
    ctx.reply(`Do I know you? #${ctx.from?.id}`);
    return "";
  }

  return assistantThreadIdInsert(ctx);
}
