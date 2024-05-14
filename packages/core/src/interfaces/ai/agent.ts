import { AppContext } from "src/interfaces/app";
import { Tool } from "./tool";

export type AgentMessage = {
  imageUrl?: string;
  text: string;
};

type RespondInput = {
  ctx: AppContext;
  message: AgentMessage;
  tools: Tool<any>[];
};

export type Agent = {
  respond: (input: RespondInput) => Promise<void>;
};
