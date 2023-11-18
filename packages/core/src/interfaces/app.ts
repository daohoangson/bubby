import { Chat } from "./chat";
import { KV } from "./storage/kv";
import { User } from "./user";

export type AppContext<T extends Chat = Chat> = {
  chat: T;
  kv: KV;
  user: User;
};
