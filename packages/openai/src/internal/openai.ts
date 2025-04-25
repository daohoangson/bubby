import { zodToJsonSchema } from "zod-to-json-schema";
import OpenAI from "openai";
import { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import { FunctionTool } from "openai/resources/responses/responses";
import { Config } from "sst/node/config";

import { Tool } from "@bubby/core/interfaces/ai";

export const openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
export const responseStreamParams: Omit<ResponseStreamParams, "input"> = {
  model: "gpt-4o-mini",
  parallel_tool_calls: false,
};
export const responses = openai.responses;

export function buildTools(tools: Tool<any>[]) {
  const output = tools.map<FunctionTool>((tool) => {
    const parameters = zodToJsonSchema(tool.parametersSchema);
    return {
      type: "function",
      description: tool.description,
      name: tool.name,
      parameters,
      strict: true,
    };
  });

  console.log(JSON.stringify(output, null, 2));

  return output;
}
