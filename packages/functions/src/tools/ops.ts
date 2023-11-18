import { z } from "zod";

import { Tool } from "@bubby/core/interfaces/ai";
import { assistantThreadIdInsert } from "@bubby/openai";

const newThreadParameters = z.object({});

export const newThread: Tool<z.infer<typeof newThreadParameters>> = {
  description: "Discard the recent messages and start a new thread.",
  name: "new_thread",
  handler: async ({ ctx }) => {
    ctx.chat.reply({ type: "system", system: "🚨 New thread" });
    return assistantThreadIdInsert(ctx);
  },
  parametersSchema: newThreadParameters,
};
