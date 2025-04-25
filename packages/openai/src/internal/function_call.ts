import { APIError } from "openai";
import {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { serializeError } from "serialize-error";

import { Tool } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { buildTools, responses, responseStreamParams } from "./openai";

type StreamResponseFunctionToolCallInput = {
  ctx: AppContext;
  previousResponseId: string;
  tools: Tool<any>[];
};

export async function streamResponseFunctionToolCall(
  input: StreamResponseFunctionToolCallInput,
  functionToolCalls: ResponseFunctionToolCall[]
) {
  const { previousResponseId, tools } = input;
  const functionCallOutputs: ResponseInputItem.FunctionCallOutput[] = [];

  for (const toolCall of functionToolCalls) {
    if (functionCallOutputs.length > 0) {
      functionCallOutputs.push({
        type: "function_call_output",
        call_id: toolCall.id,
        output: '{"error":"Cannot take more than one action at a time."}',
      });
      continue;
    }

    for (const tool of tools) {
      if (toolCall.name === tool.name) {
        const output = await buildFunctionCallOutput(input, toolCall, tool);
        functionCallOutputs.push(output);
      }
    }
  }

  return responses.stream({
    ...responseStreamParams,
    input: functionCallOutputs,
    previous_response_id: previousResponseId,
    tools: buildTools(tools),
  });
}

async function buildFunctionCallOutput<T>(
  { ctx }: StreamResponseFunctionToolCallInput,
  functionToolCall: ResponseFunctionToolCall,
  tool: Tool<T>
): Promise<ResponseInputItem.FunctionCallOutput> {
  let parameters: T;
  const { arguments: paramsString, name } = functionToolCall;
  try {
    parameters = tool.parametersSchema.parse(JSON.parse(paramsString));
  } catch (paramsError) {
    console.error({ paramsString, paramsError });
    return {
      type: "function_call_output",
      call_id: functionToolCall.id,
      output: JSON.stringify(serializeError(paramsError)),
    };
  }

  try {
    const success = await tool.handler({ ctx, parameters });
    return {
      type: "function_call_output",
      call_id: functionToolCall.id,
      output:
        typeof success === "boolean"
          ? JSON.stringify({ success })
          : JSON.stringify(success),
    };
  } catch (toolError) {
    let failure = toolError;
    if (toolError instanceof APIError) {
      failure = toolError.error;
    }
    console.error({ name, parameters, toolError });
    return {
      type: "function_call_output",
      call_id: functionToolCall.id,
      output: JSON.stringify(serializeError(failure)),
    };
  }
}
