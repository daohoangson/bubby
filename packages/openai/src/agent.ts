import { AssistantStream } from "openai/lib/AssistantStream";
import { FunctionToolCall } from "openai/resources/beta/threads/runs/steps";

import { Agent } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import {
  assistantSendMessage,
  endOfThinking,
} from "./internal/assistant_message";
import { assistantThreadIdUpsert } from "./internal/assistant_thread";
import { assistantSubmitToolOutputs } from "./internal/assistant_tool_outputs";

class AgentStreamer {
  constructor(private ctx: AppContext, private threadId: string) {}

  async consume(stream: AssistantStream): Promise<AssistantStream | undefined> {
    const { ctx, threadId } = this;
    let state:
      | { type: "code_interpreter" | "file_search" }
      | { type: "function"; toolCall: FunctionToolCall }
      | { type: "text"; text: string }
      | undefined;

    const functionToolCalls: FunctionToolCall[] = [];
    const resetState = (newState?: typeof state) => {
      switch (state?.type) {
        case "function":
          functionToolCalls.push(state.toolCall);
          break;
        case "text":
          let markdown = state.text;

          const thinkingIndex = markdown.indexOf(endOfThinking);
          if (thinkingIndex > -1) {
            markdown = markdown
              .slice(thinkingIndex + endOfThinking.length)
              .trim();
          }

          if (markdown.length > 0) {
            void ctx.chat.reply({ type: "markdown", markdown });
          }
          break;
      }
      state = newState;
    };

    stream
      .on("textCreated", () => {
        resetState({ type: "text", text: "" });
        void ctx.chat.typing();
      })
      .on("textDelta", (textDelta) => {
        if (state?.type === "text") {
          state.text += textDelta.value ?? "";
        }
      })
      .on("toolCallCreated", (toolCall) => {
        const { type } = toolCall;
        switch (type) {
          case "function":
            resetState({ type, toolCall });
            break;
        }
      })
      .on("toolCallDelta", (toolCallDelta) => {
        const { type } = toolCallDelta;
        switch (type) {
          case "function":
            if (state?.type === type) {
              state.toolCall.function.arguments +=
                toolCallDelta.function?.arguments ?? "";
            }
            break;
        }
      })
      .on("messageDone", (message) => {
        for (const content of message.content) {
          if (content.type === "text") {
            ctx.pushMessage({
              role: "assistant",
              threadId: message.thread_id,
              text: content.text.value,
            });
          }
        }
        console.log(JSON.stringify(message, null, 2));
      });

    const run = await stream.finalRun(); // wait for OpenAI
    resetState(); // flush the last state

    if (functionToolCalls.length === 0) {
      if (run.status === "failed" || run.status === "incomplete") {
        for (const tool of ctx.tools) {
          if (tool.name === "new_thread") {
            // force new thread in case of run failure
            const parameters = tool.parametersSchema.parse({});
            await tool.handler({ ctx, parameters });
            throw new Error(JSON.stringify(run));
          }
        }
      }

      return; // bail early if there is no function tool call
    }

    const runId = run.id;
    const input = { ctx, runId, threadId };
    return assistantSubmitToolOutputs(input, functionToolCalls);
  }
}

export const agent: Agent = {
  respond: async ({ ctx, message }) => {
    const threadId = await assistantThreadIdUpsert(ctx);
    const streamer = new AgentStreamer(ctx, threadId);
    const firstStream = await assistantSendMessage(ctx, threadId, message);

    let stream: typeof firstStream | undefined = firstStream;
    while (typeof stream !== "undefined") {
      stream = await streamer.consume(stream);
    }
  },
};
