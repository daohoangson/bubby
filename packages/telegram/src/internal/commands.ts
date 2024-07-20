import { Telegraf } from "telegraf";
import { BotCommand } from "telegraf/typings/core/types/typegram";

import { kv } from "@bubby/aws";

interface Command extends BotCommand {
  handler: Parameters<Telegraf["command"]>[1];
}

export const commands: Command[] = [
  {
    command: "thread_get",
    description: "Get the current thread id",
    handler: async (ctx) => {
      const threadId = await kv.get(`${ctx.chat.id}`, "assistant-thread-id");
      ctx.reply(threadId ?? "N/A");
    },
  },
  {
    command: "thread_reset",
    description: "Reset thread id",
    handler: async (ctx) => {
      await kv.unset(`${ctx.chat.id}`, "assistant-thread-id");
      ctx.reply("✅");
    },
  },
];
