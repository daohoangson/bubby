import { APIError } from "openai";
import type {
  RequiredActionFunctionToolCall,
  Run,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import { serializeError } from "serialize-error";
import { z } from "zod";

import { AssistantError } from "../../abstracts/assistant";
import {
  analyzeImage,
  analyzeImageParameters,
  generateImage,
  generateImageParameters,
} from "./tools/image";
import { newThread } from "./tools/ops";
import {
  AssistantThreadInput,
  assistantThreadIdInsert,
} from "./assistant_thread";
import { threads } from "./openai";
import { visionAnalyzeImage, visionGenerateImage } from "./vision_preview";

export type AssistantTakeRequiredActionsInput = AssistantThreadInput & {
  threadId: string;
  runId: string;
};

export async function assistantTakeRequiredActions(
  input: AssistantTakeRequiredActionsInput
): Promise<boolean> {
  const { threadId, runId } = input;
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
  throw new AssistantError("Something went wrong, please try again later.");
}

async function takeRequiredActions(
  input: AssistantTakeRequiredActionsInput,
  requiredAction: Run.RequiredAction
): Promise<void> {
  const { threadId, runId } = input;

  switch (requiredAction.type) {
    case "submit_tool_outputs":
      const sto = requiredAction.submit_tool_outputs;
      const tool_outputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
      for (const toolCall of sto.tool_calls) {
        switch (toolCall.function.name) {
          // image
          case analyzeImage.function.name:
            const analyzedImage = await takeRequiredAction(
              toolCall,
              analyzeImageParameters,
              async (params) => {
                input.chat.reply({
                  type: "system",
                  system: "🚨 Analyzing image...",
                });
                return await visionAnalyzeImage(input, params);
              }
            );
            tool_outputs.push(analyzedImage);
            break;
          case generateImage.function.name:
            const generatedImage = await takeRequiredAction(
              toolCall,
              generateImageParameters,
              async (params) => {
                input.chat.reply({
                  type: "system",
                  system: "🚨 Generating image...",
                });
                const image = await visionGenerateImage(params);
                if (typeof image === "undefined") {
                  return false;
                }

                input.chat.reply({ type: "photo", ...image });
                return {
                  success: true,
                  description: `Image has been generated and sent to user successfully.`,
                };
              }
            );
            tool_outputs.push(generatedImage);
            break;
          // ops
          case newThread.function.name:
            const newThreadId = await takeRequiredAction(
              toolCall,
              z.object({}),
              async () => {
                const inserted = await assistantThreadIdInsert(input);
                input.chat.reply({ type: "system", system: "🚨 New thread" });
                return inserted;
              }
            );
            tool_outputs.push(newThreadId);
            break;
        }
      }
      await threads.runs.submitToolOutputs(threadId, runId, { tool_outputs });
      break;
  }
}

async function takeRequiredAction<T>(
  toolCall: RequiredActionFunctionToolCall,
  parameters: z.ZodType<T>,
  callback: (parameters: T) => Promise<any>
): Promise<RunSubmitToolOutputsParams.ToolOutput> {
  let paramsParsed: T;
  const { arguments: paramsString, name } = toolCall.function;
  try {
    paramsParsed = parameters.parse(JSON.parse(paramsString));
  } catch (paramsError) {
    console.warn({ paramsString, paramsError });
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(paramsError)),
    };
  }

  try {
    const success = await callback(paramsParsed);
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
    console.warn({ name, paramsParsed, takeRequiredActionError });
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(failure)),
    };
  }
}
