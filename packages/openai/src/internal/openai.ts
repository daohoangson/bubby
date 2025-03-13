import { generateSchema } from "@anatine/zod-openapi";
import { Tool } from "@bubby/core/interfaces/ai";
import OpenAI from "openai";
import { ResponseStreamParams } from "openai/lib/responses/ResponseStream";
import { FunctionTool } from "openai/resources/responses/responses";
import { Config } from "sst/node/config";

export const openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
export const responseStreamParams: Omit<ResponseStreamParams, "input"> = {
  model: "gpt-4o-mini",
  parallel_tool_calls: false,
};
export const responses = openai.responses;

export function buildTools(tools: Tool<any>[]) {
  return tools.map<FunctionTool>((tool) => {
    const schema = generateSchema(tool.parametersSchema);
    return {
      type: "function",
      description: tool.description,
      name: tool.name,
      parameters: schema as FunctionTool["parameters"],
      strict: true,
    };
  });
}
