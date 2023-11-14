type Key = "assistant-thread-id" | "memory";

export type KV = {
  get: (channelId: string, key: Key) => Promise<string | undefined>;
  set: (channelId: string, key: Key, value: string) => Promise<void>;
};
