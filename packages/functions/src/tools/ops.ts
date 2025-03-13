import { z } from "zod";

import { Tool } from "@bubby/core/interfaces/ai";

const newThreadParameters = z.object({});

export const newThread: Tool<z.infer<typeof newThreadParameters>> = {
  description: "Discard the recent messages and start a new thread.",
  name: "new_thread",
  handler: async ({ ctx }) => {
    ctx.chat.reply({ type: "system", system: "🚨 New thread" });
    ctx.kv.unset(ctx.chat.getChannelId(), "previous-message-id");
    return true;
  },
  parametersSchema: newThreadParameters,
};
