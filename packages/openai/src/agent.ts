import { Agent, Tool } from "@bubby/core/interfaces/ai";
import { AppContext } from "@bubby/core/interfaces/app";
import { ResponseStream } from "openai/lib/responses/ResponseStream";
import {
  ResponseCompletedEvent,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";
import { streamResponseFunctionToolCall } from "./internal/function_call";
import { streamUserMessage } from "./internal/user_message";

class AgentStreamer {
  constructor(private ctx: AppContext, private tools: Tool<any>[]) {}

  async consume(stream: ResponseStream): Promise<ResponseStream | undefined> {
    const functionToolCalls: ResponseFunctionToolCall[] = [];
    const functionCallsByItemId: Record<
      string,
      { callId: string; name: string }
    > = {};
    let response: ResponseCompletedEvent["response"] | undefined;

    stream
      .on("response.content_part.added", () => {
        void this.ctx.chat.typing();
      })
      .on("response.output_text.done", ({ text }) => {
        if (text.length > 0) {
          void this.ctx.chat.reply({ type: "markdown", markdown: text });
        }
      })
      .on("response.output_item.added", ({ item }) => {
        if (item.type === "function_call") {
          functionCallsByItemId[item.id] = {
            callId: item.call_id,
            name: item.name,
          };
        }
      })
      .on("response.function_call_arguments.done", (functionCall) => {
        const { callId, name } = functionCallsByItemId[functionCall.item_id];
        functionToolCalls.push({
          type: "function_call",
          arguments: functionCall.arguments,
          call_id: callId,
          id: functionCall.item_id,
          name,
        });
      })
      .on("response.completed", (completed) => {
        response = completed.response;
      });

    await stream.done(); // wait for OpenAI

    const { ctx, tools } = this;
    if (functionToolCalls.length === 0) {
      const status = response?.status ?? "incomplete";
      if (status === "failed" || status === "incomplete") {
        for (const tool of tools) {
          if (tool.name === "new_thread") {
            // force new thread in case of failure
            const parameters = tool.parametersSchema.parse({});
            await tool.handler({ ctx, parameters });
            throw new Error(JSON.stringify(response));
          }
        }
      }

      return; // bail early if there is no function tool call
    }

    return streamResponseFunctionToolCall(
      {
        ctx,
        previousResponseId: response!.id,
        tools,
      },
      functionToolCalls
    );
  }
}

export const agent: Agent = {
  respond: async ({ ctx, message, tools }) => {
    // const threadId = await assistantThreadIdUpsert(ctx);
    const previousResponseId = await ctx.kv.get(
      ctx.chat.getChannelId(),
      "responseIdx"
    );
    const streamer = new AgentStreamer(ctx, tools);
    const firstStream = await streamUserMessage({
      ctx,
      previousResponseId,
      message,
      tools,
    });

    let stream: typeof firstStream | undefined = firstStream;
    while (typeof stream !== "undefined") {
      stream = await streamer.consume(stream);
    }
  },
};
