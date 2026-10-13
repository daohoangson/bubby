import supermemory from "@supermemory/eve";
import { defineMemory } from "eve/memory";

export default defineMemory({
  description: "Recall and manage durable context shared by all Bubby conversations.",
  // Eve's default local namespace hashes a temporary source snapshot path.
  namespace: () => process.env.VERCEL_ENV === "production" ? "bubby-production" : "bubby-dev",
  provider: supermemory({
    apiKey: () => process.env.SUPERMEMORY_API_KEY!,
  }),
  scope: "bubby-shared-v1",
});
