import { AssistantStream } from "openai/lib/AssistantStream";
import { FunctionToolCall } from "openai/resources/beta/threads/runs/steps";

import { Agent, Tool } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { assistantSendMessage } from "./internal/assistant_message";
import { assistantThreadIdUpsert } from "./internal/assistant_thread";
import { assistantSubmitToolOutputs } from "./internal/assistant_tool_outputs";

class AgentStreamer {
  constructor(
    private ctx: AppContext,
    private threadId: string,
    private tools: Tool<any>[]
  ) {}

  async consume(stream: AssistantStream): Promise<AssistantStream | undefined> {
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
          const markdown = state.text;
          if (markdown.length > 0) {
            void this.ctx.chat.reply({ type: "markdown", markdown });
          }
          break;
      }
      state = newState;
    };

    stream
      .on("textCreated", () => {
        resetState({ type: "text", text: "" });
        void this.ctx.chat.typing();
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
      });

    const run = await stream.finalRun(); // wait for OpenAI
    resetState(); // flush the last state
    if (functionToolCalls.length === 0) {
      return; // bail early if there is no function tool call
    }

    const { ctx, threadId, tools } = this;
    const runId = run.id;
    const input = { ctx, runId, threadId, tools };
    return assistantSubmitToolOutputs(input, functionToolCalls);
  }
}

export const agent: Agent = {
  respond: async ({ ctx, message, tools }) => {
    const threadId = await assistantThreadIdUpsert(ctx);
    const streamer = new AgentStreamer(ctx, threadId, tools);
    const firstStream = await assistantSendMessage(threadId, message, tools);

    let stream: typeof firstStream | undefined = firstStream;
    while (typeof stream !== "undefined") {
      stream = await streamer.consume(stream);
    }
  },
};
