import { AgentMessage, Tool } from "./ai";
import { Chat } from "./chat";
import { KV } from "./storage/kv";
import { User } from "./user";

export interface AppContext<T extends Chat = Chat> {
  readonly chat: T;
  readonly kv: KV;
  readonly messages: Iterable<AgentMessage>;
  readonly tools: Tool<any>[];
  readonly user: User;

  pushMessage(message: AgentMessage): Promise<void>;
  onNewMessage(handler: (message: AgentMessage) => Promise<void>): void;
}
