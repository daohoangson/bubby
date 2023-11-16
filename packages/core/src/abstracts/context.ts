import { Chat } from "./chat";
import { KV } from "./kv";
import { User } from "./user";

export type ChatContext<T extends Chat = Chat> = {
  chat: T;
  kv: KV;
  user: User;
};
