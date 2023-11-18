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
import { overwriteMemory, overwriteMemoryParameters } from "./tools/memory";
import { newThread } from "./tools/ops";
import { assistantThreadIdInsert } from "./assistant_thread";
import { threads } from "./openai";
import { visionAnalyzeImage, visionGenerateImage } from "./vision_preview";
import { ChatContext } from "../../abstracts/context";

type AssistantTakeRequiredActionsInput = {
  ctx: ChatContext;
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
  { ctx, runId, threadId }: AssistantTakeRequiredActionsInput,
  requiredAction: Run.RequiredAction
): Promise<void> {
  const { chat, kv } = ctx;

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

        switch (toolCall.function.name) {
          // image
          case analyzeImage.function.name:
            const analyzedImage = await takeRequiredAction(
              toolCall,
              analyzeImageParameters,
              (params) => {
                chat.reply({ type: "system", system: "🚨 Analyzing image..." });
                return visionAnalyzeImage({ ctx, ...params });
              }
            );
            tool_outputs.push(analyzedImage);
            break;
          case generateImage.function.name:
            const generatedImage = await takeRequiredAction(
              toolCall,
              generateImageParameters,
              async (params) => {
                chat.reply({ type: "system", system: "🚨 Generating..." });
                const image = await visionGenerateImage(params);
                if (typeof image === "undefined") {
                  return false;
                }

                const { revised_prompt, url } = image;
                chat.reply({ type: "system", system: "🚨 Uploading..." });
                await chat.reply({
                  type: "photo",
                  url,
                  caption: revised_prompt ?? params.prompt,
                });

                return {
                  success: true,
                  description:
                    typeof revised_prompt === "string"
                      ? `Image has been generated with a revised prompt: ${revised_prompt}\n\nThe image and revised prompt have been sent to user successfully.`
                      : `Image has been generated and sent to user successfully.`,
                };
              }
            );
            tool_outputs.push(generatedImage);
            break;
          // memory
          case overwriteMemory.function.name:
            const overwritten = await takeRequiredAction(
              toolCall,
              overwriteMemoryParameters,
              async (params) => {
                await kv.set(chat.getChannelId(), "memory", params.memory);
                return true;
              }
            );
            tool_outputs.push(overwritten);
            break;
          // ops
          case newThread.function.name:
            const newThreadId = await takeRequiredAction(
              toolCall,
              z.object({}),
              () => {
                chat.reply({ type: "system", system: "🚨 New thread" });
                return assistantThreadIdInsert(ctx);
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
    console.error({ paramsString, paramsError });
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
    console.error({ name, paramsParsed, takeRequiredActionError });
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(serializeError(failure)),
    };
  }
}
