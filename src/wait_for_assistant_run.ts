import { RunSubmitToolOutputsParams } from "openai/resources/beta/threads/runs/runs";
import { Context } from "telegraf";

import { assistantThreadIdInsert } from "./assistant_thread_id";
import { threads } from "./config";

export async function waitForAssistantRun(
  ctx: Context,
  threadId: string,
  runId: string
): Promise<boolean> {
  while (true) {
    const run = await threads.runs.retrieve(threadId, runId);
    let isRunning = false;
    switch (run.status) {
      case "requires_action":
        switch (run.required_action?.type) {
          case "submit_tool_outputs":
            const sto = run.required_action.submit_tool_outputs;
            const tool_outputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
            for (const toolCall of sto.tool_calls) {
              if (toolCall.function.name === "new_thread") {
                const newThreadId = await assistantThreadIdInsert(ctx);
                tool_outputs.push({
                  tool_call_id: toolCall.id,
                  output: newThreadId,
                });
              }
            }
            await threads.runs.submitToolOutputs(threadId, runId, {
              tool_outputs,
            });
            await ctx.reply("🚨 NEW THREAD 🚨");
            return false;
        }
        break;
      case "completed":
        return true;
      case "queued":
      case "in_progress":
        isRunning = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        break;
    }

    if (!isRunning) {
      console.warn("Unexpected run status", { run });
      await ctx.reply("Something went wrong, please try again later.");
      return false;
    }
  }
}
