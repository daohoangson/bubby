import { VercelRequest, VercelResponse } from "@vercel/node";
import { Context } from "telegraf";

import {
  assistantId as assistant_id,
  assistantThreadIdUpsert,
  bot,
  threads,
  verifySecretToken,
  waitForAssistantRun,
} from "../src";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (verifySecretToken(req)) {
    try {
      await bot.handleUpdate(req.body);
    } catch (error) {
      console.error("Could not handle update", { error });
    }
  }

  res.send("OK");
};

bot.on("text", async (ctx) => {
  try {
    const threadId = await assistantThreadIdUpsert(ctx);
    await generateReply(ctx, threadId, ctx.message.text);
  } catch (error) {
    await ctx.reply(error.message);
    console.error("Could not generate reply", { error });
  }
});

async function generateReply(ctx: Context, threadId: string, content: string) {
  if (threadId.length === 0) return;

  await ctx.sendChatAction("typing");
  console.log({ threadId, content });
  await threads.messages.create(threadId, { content, role: "user" });
  const runId = (await threads.runs.create(threadId, { assistant_id })).id;

  const isCompleted = await waitForAssistantRun(ctx, threadId, runId);
  if (!isCompleted) {
    return;
  }

  const list = await threads.messages.list(threadId);
  for (const threadMessage of list.data) {
    if (threadMessage.run_id === runId) {
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
