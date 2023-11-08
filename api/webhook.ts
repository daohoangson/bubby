import { kv } from "@vercel/kv";
import { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { Context, Telegraf } from "telegraf";

const assistant_id = process.env.OPENAI_ASSISTANT_ID ?? "";
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const threads = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).beta.threads;

export default async (req: VercelRequest, res: VercelResponse) => {
  if (
    req.headers["x-telegram-bot-api-secret-token"] ===
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN
  ) {
    try {
      await bot.handleUpdate(req.body);
    } catch (error) {
      console.error(error);
    }
  }

  res.send("OK");
};

bot.on("text", async (ctx) => {
  try {
    const threadId = await upsertThreadId(ctx);
    await generateReply(ctx, threadId, ctx.message.text);
  } catch (error) {
    await ctx.reply(error.message);
    console.error(error);
  }
});

async function upsertThreadId(ctx: Context): Promise<string> {
  const kvKey = `thread-id-by-chat-id-${ctx.chat?.id}`;
  const existingThreadId = await kv.get<string>(kvKey);
  if (typeof existingThreadId === "string") {
    return existingThreadId;
  }

  if (ctx.from?.id !== 552046506) {
    // https://t.me/daohoangson
    ctx.reply(`Do I know you? #${ctx.from?.id}`);
    return "";
  }

  const threadId = (await threads.create({})).id;
  await kv.set<string>(kvKey, threadId);
  console.log({ kvKey, threadId });
  return threadId;
}

async function generateReply(ctx: Context, threadId: string, content: string) {
  if (threadId.length === 0) return;

  await ctx.sendChatAction("typing");
  console.log({ threadId, content });
  await threads.messages.create(threadId, { content, role: "user" });
  const run = await threads.runs.create(threadId, { assistant_id });

  while (true) {
    const pooling = await threads.runs.retrieve(threadId, run.id);
    if (pooling.status === "completed") {
      break;
    }
  }

  const list = await threads.messages.list(threadId);
  for (const threadMessage of list.data) {
    if (threadMessage.run_id === run.id) {
      for (const messageContent of threadMessage.content) {
        if (messageContent.type === "text") {
          const reply = messageContent.text.value;
          console.log({ threadId, reply });
          await ctx.reply(reply, { parse_mode: "Markdown" });
        }
      }
    }
  }
}
