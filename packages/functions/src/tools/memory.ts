import { z } from "zod";

import { Tool } from "@bubby/core/interfaces/ai";

const overwriteMemoryParameters = z.object({
  memory: z.string({
    description: "New memory to overwrite the existing one.",
  }),
});

export const overwriteMemory: Tool<z.infer<typeof overwriteMemoryParameters>> =
  {
    description: "Overwrite memory.",
    name: "overwrite_memory",
    handler: async ({ ctx, parameters }) => {
      const { chat, kv } = ctx;
      await kv.set(chat.getChannelId(), "memory", parameters.memory);
      return true;
    },
    parametersSchema: overwriteMemoryParameters,
  };
