import { AppContext } from "src/interfaces/app";

export type AgentMessage = {
  imageUrl?: string;
  role: "assistant" | "user";
  text: string;
  threadId: string;
};

export type UserMessage = {
  imageUrl?: string;
  text: string;
};

type RespondInput = {
  ctx: AppContext;
  message: UserMessage;
};

export type Agent = {
  respond: (input: RespondInput) => Promise<void>;
};
