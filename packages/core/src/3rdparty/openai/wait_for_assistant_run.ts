import { APIError } from "openai";
import type {
  RequiredActionFunctionToolCall,
  Run,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import { serializeError } from "serialize-error";
import { z } from "zod";

import {
  AssistantThreadInput,
  assistantThreadIdInsert,
} from "./assistant_thread";
import { threads } from "./openai";
import { Reply } from "../../abstracts/chat";
import { AssistantError } from "../../abstracts/assistant";
import {
  analyzeImage,
  analyzeImageParameters,
  generateImage,
  generateImageParameters,
} from "./tools/image";
import { newThread } from "./tools/ops";
import { visionAnalyzeImage, visionGenerateImage } from "./vision_preview";

export type AsisstantWaitForRunInput = AssistantThreadInput & {
  threadId: string;
  runId: string;
};

export async function* assistantWaitForRun(
  input: AsisstantWaitForRunInput
): AsyncGenerator<Reply> {
  const { threadId, runId } = input;
  while (true) {
    const run = await threads.runs.retrieve(threadId, runId);
    let isRunning = false;
    switch (run.status) {
      case "requires_action":
        isRunning = true;
        yield* takeRequiredActions(input, run.required_action!);
        break;
      case "completed":
        return;
      case "queued":
      case "in_progress":
        isRunning = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        break;
    }

    if (!isRunning) {
      console.warn("Unexpected run status", { run });
      throw new AssistantError("Something went wrong, please try again later.");
    }
  }
}

async function* takeRequiredActions(
  input: AsisstantWaitForRunInput,
  requiredAction: Run.RequiredAction
): AsyncGenerator<Reply> {
  const { threadId, runId } = input;

  switch (requiredAction.type) {
    case "submit_tool_outputs":
      const sto = requiredAction.submit_tool_outputs;
      const tool_outputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
      for (const toolCall of sto.tool_calls) {
        switch (toolCall.function.name) {
          // image
          case analyzeImage.function.name:
            const analyzedImage = yield* takeRequiredAction(
              toolCall,
              analyzeImageParameters,
              async function* (params) {
                yield { type: "system", system: "🚨 Analyzing image..." };
                return await visionAnalyzeImage(input, params);
              }
            );
            tool_outputs.push(analyzedImage);
            break;
          case generateImage.function.name:
            const generatedImage = yield* takeRequiredAction(
              toolCall,
              generateImageParameters,
              async function* (params) {
                yield {
                  type: "system",
                  system: "🚨 Generating image...",
                };
                const image = await visionGenerateImage(params);
                yield { type: "photo", ...image } as Reply;
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
            const newThreadId = yield* takeRequiredAction(
              toolCall,
              z.object({}),
              async function* () {
                const inserted = await assistantThreadIdInsert(input);
                yield { type: "system", system: "🚨 New thread" };
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

async function* takeRequiredAction<T>(
  toolCall: RequiredActionFunctionToolCall,
  parameters: z.ZodType<T>,
  callback: (parameters: T) => AsyncGenerator<Reply, any>
): AsyncGenerator<Reply, RunSubmitToolOutputsParams.ToolOutput> {
  let params: T;
  try {
    const json = JSON.parse(toolCall.function.arguments);
    params = parameters.parse(json);
  } catch (paramsError) {
    const obj = { paramsError: serializeError(paramsError) };
    console.warn(obj);
    return { tool_call_id: toolCall.id, output: JSON.stringify(obj) };
  }

  try {
    const success = yield* callback(params);
    return {
      tool_call_id: toolCall.id,
      output:
        typeof success === "boolean"
          ? JSON.stringify({ success })
          : JSON.stringify(success),
    };
  } catch (error) {
    let obj: any = { error: serializeError(error) };
    if (error instanceof APIError) {
      obj = { apiError: serializeError(error.error) };
    }
    console.warn(obj);
    return { tool_call_id: toolCall.id, output: JSON.stringify(obj) };
  }
}
