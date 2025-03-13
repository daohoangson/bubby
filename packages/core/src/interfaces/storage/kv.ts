type Key = "memory" | "previous-message-id";

export type KV = {
  get: (channelId: string, key: Key) => Promise<string | undefined>;
  set: (channelId: string, key: Key, value: string) => Promise<void>;
  unset: (channelId: string, key: Key) => Promise<void>;
};
