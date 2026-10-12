import supermemory from "@supermemory/eve";
import { defineMemory } from "eve/memory";
import { telegramMemoryScope } from "../../lib/memory-scope.ts";

export default defineMemory({
  description: "Recall and manage durable context for the current user.",
  provider: supermemory({
    apiKey: () => process.env.SUPERMEMORY_API_KEY!,
  }),
  scope: telegramMemoryScope,
});
