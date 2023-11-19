import { APIError } from "openai";
import type {
  RequiredActionFunctionToolCall,
  Run,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import { serializeError } from "serialize-error";
import { z } from "zod";

import { AppContext } from "@bubby/core/interfaces/app";
import { assistantThreadIdInsert } from "./assistant_thread";
import { threads } from "./openai";
import { visionAnalyzeImage, visionGenerateImage } from "./vision_preview";
import { Tool } from "@bubby/core/interfaces/ai";

type AssistantTakeRequiredActionsInput = {
  ctx: AppContext;
  runId: string;
  threadId: string;
  tools: Tool<any>[];
};

export async function assistantTakeRequiredActions(
  input: AssistantTakeRequiredActionsInput
): Promise<boolean> {
  const { runId, threadId } = input;
  const run = await threads.runs.retrieve(threadId, runId);

  switch (run.status) {
    case "requires_action":
      await takeRequiredActions(input, run.required_action!);
      return false;
    case "completed":
      return true;
    case "queued":
    case "in_progress":
      await new Promise((resolve) => setTimeout(resolve, 100));
      return false;
  }

  console.warn("Unexpected run status", { run });
  throw new Error("Something went wrong, please try again later.");
}

async function takeRequiredActions(
  input: AssistantTakeRequiredActionsInput,
  requiredAction: Run.RequiredAction
): Promise<void> {
  const { runId, threadId, tools } = input;

  switch (requiredAction.type) {
    case "submit_tool_outputs":
      const sto = requiredAction.submit_tool_outputs;
      const tool_outputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
      for (const toolCall of sto.tool_calls) {
        if (tool_outputs.length > 0) {
          tool_outputs.push({
            tool_call_id: toolCall.id,
            output: '{"error":"Cannot take more than one action at a time."}',
          });
          continue;
        }

        for (const tool of tools) {
          if (toolCall.function.name === tool.name) {
            const output = await takeRequiredAction(input, toolCall, tool);
            tool_outputs.push(output);
          }
        }
      }
      await threads.runs.submitToolOutputs(threadId, runId, { tool_outputs });
      break;
  }
}

async function takeRequiredAction<T>(
  { ctx }: AssistantTakeRequiredActionsInput,
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
  } catch (takeRequiredActionError) {
    let failure = takeRequiredActionError;
    if (takeRequiredActionError instanceof APIError) {
      failure = takeRequiredActionError.error;
    }
    console.error({ name, parameters, takeRequiredActionError });
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(failure)),
    };
  }
}
