import { Agent } from "@bubby/core/interfaces/ai";

import {
  assistantGetNewMessages,
  assistantSendMessage,
} from "./internal/assistant_message";
import { assistantTakeRequiredActions } from "./internal/assistant_take_required_actions";
import { assistantThreadIdUpsert } from "./internal/assistant_thread";

export const agent: Agent = {
  respond: async ({ ctx, message, tools }) => {
    const { chat } = ctx;
    const threadId = await assistantThreadIdUpsert(ctx);
    const { runId } = await assistantSendMessage(threadId, message, tools);

    const messageIds: string[] = [];
    let shouldBreak = false;
    let loopCount = 0;
    while (true) {
      loopCount++;
      const [isRunCompleted] = await Promise.all([
        assistantTakeRequiredActions({ ctx, runId, threadId, tools }),
        assistantGetNewMessages(threadId, runId, messageIds).then(
          (messages) => {
            for (const message of messages) {
              console.log(JSON.stringify({ loopCount, message }, null, 2));
              for (const messageContent of message.content) {
                if (messageContent.type === "text") {
                  const markdown = messageContent.text.value;
                  if (markdown.length > 0) {
                    messageIds.push(message.id);
                    chat.reply({ type: "markdown", markdown });
                  }
                }
              }
            }
          },
          (getNewMessagesError) => console.warn({ getNewMessagesError })
        ),
      ]);

      if (shouldBreak) {
        break;
      }

      if (isRunCompleted) {
        // after the run is completed, let the loop run one more time
        // in order to get the last messages
        shouldBreak = true;
      }
    }
  },
};
