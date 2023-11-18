import { AppContext } from "src/interfaces/app";
import { Tool } from "./tool";

type RespondInput = {
  ctx: AppContext;
  message: string;
  tools: Tool<any>[];
};

export type Agent = {
  respond: (input: RespondInput) => Promise<void>;
};
