import { APIError } from "openai";
import { AssistantStream } from "openai/lib/AssistantStream";
import type {
  RequiredActionFunctionToolCall,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import { FunctionToolCall } from "openai/resources/beta/threads/runs/steps";
import { serializeError } from "serialize-error";

import { Tool } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { threads } from "./openai";

type AssistantSubmitToolOutputsInput = {
  ctx: AppContext;
  runId: string;
  threadId: string;
};

export async function assistantSubmitToolOutputs(
  input: AssistantSubmitToolOutputsInput,
  functionToolCalls: FunctionToolCall[]
): Promise<AssistantStream> {
  const { ctx, runId, threadId } = input;
  const { tools } = ctx;
  const tool_outputs: RunSubmitToolOutputsParams.ToolOutput[] = [];

  for (const toolCall of functionToolCalls) {
    if (tool_outputs.length > 0) {
      tool_outputs.push({
        tool_call_id: toolCall.id,
        output: '{"error":"Cannot take more than one action at a time."}',
      });
      continue;
    }

    for (const tool of tools) {
      if (toolCall.function.name === tool.name) {
        const output = await buildToolOutput(input, toolCall, tool);
        tool_outputs.push(output);
      }
    }
  }

  return threads.runs.submitToolOutputsStream(threadId, runId, {
    tool_outputs,
  });
}

async function buildToolOutput<T>(
  { ctx }: AssistantSubmitToolOutputsInput,
  toolCall: RequiredActionFunctionToolCall,
  tool: Tool<T>
): Promise<RunSubmitToolOutputsParams.ToolOutput> {
  let parameters: T;
  const { arguments: paramsString, name } = toolCall.function;
  try {
    parameters = tool.parametersSchema.parse(JSON.parse(paramsString));
  } catch (paramsError) {
    console.error({ paramsString, paramsError });
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(paramsError)),
    };
  }

  try {
    const success = await tool.handler({ ctx, parameters });
    return {
      tool_call_id: toolCall.id,
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
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(failure)),
    };
  }
}
