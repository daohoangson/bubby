import type {
  Run,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";

import {
  AssistantThreadInput,
  assistantThreadIdInsert,
} from "./assistant_thread";
import { threads } from "./openai";
import { Reply } from "../../abstracts/chat";
import { AssistantError } from "../../abstracts/assistant";
import { functions } from "./tools";
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
        const args = JSON.parse(toolCall.function.arguments) ?? {};
        switch (toolCall.function.name) {
          // image
          case functions.analyzeImage.function.name:
            try {
              yield { type: "plaintext", plaintext: "🚨 Analyzing image..." };
              const output = await visionAnalyzeImage(
                (args.prompt ?? "").trim(),
                (args.image_url ?? "").trim(),
                args.temperature ?? 0
              );
              tool_outputs.push({
                tool_call_id: toolCall.id,
                output,
              });
            } catch (error) {
              tool_outputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error }),
              });
            }
            break;
          case functions.generateImage.function.name:
            try {
              yield { type: "plaintext", plaintext: "🚨 Generating image..." };
              const image = await visionGenerateImage(
                (args.prompt ?? "").trim(),
                (args.size ?? "1024x1024").trim()
              );
              if (typeof image === "object") {
                yield { type: "photo", ...image };
              }
              tool_outputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(image),
              });
            } catch (error) {
              tool_outputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error }),
              });
            }
            break;
          // ops
          case functions.newThread.function.name:
            const newThreadId = await assistantThreadIdInsert(input);
            tool_outputs.push({
              tool_call_id: toolCall.id,
              output: newThreadId,
            });
            yield { type: "plaintext", plaintext: "🚨 New thread" };
            break;
        }
      }
      await threads.runs.submitToolOutputs(threadId, runId, { tool_outputs });
      break;
  }
}
