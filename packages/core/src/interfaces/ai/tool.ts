import { z } from "zod";

import { AppContext } from "src/interfaces/app";

type ToolHandlerInput<T> = {
  ctx: AppContext;
  parameters: T;
};

export type Tool<T> = {
  description: string;
  handler: (input: ToolHandlerInput<T>) => Promise<any>;
  name: "generate_image" | "overwrite_memory" | "new_thread";
  parametersSchema: z.ZodType<T>;
};
