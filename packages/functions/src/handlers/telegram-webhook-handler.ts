import { Config } from "sst/node/config";

import { kv } from "@bubby/aws";
import { AppContext } from "@bubby/core/interfaces/app";
import { ChatPhoto, ChatText } from "@bubby/core/interfaces/chat";
import {
  assistantGetNewMessages,
  assistantSendMessage,
  assistantTakeRequiredActions,
  assistantThreadIdUpsert,
} from "@bubby/openai";
import { onMessage } from "@bubby/telegram";

export async function handleTelegramWebhook(secretToken: string, update: any) {
  const expectedSecretToken = Config.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (secretToken !== expectedSecretToken) {
    console.warn("Unrecognized secret token", { secretToken });
    return;
  }

  console.log(JSON.stringify(update, null, 2));
  await onMessage({
    onPhoto: (input) => replyToPhoto({ ...input, kv }),
    onText: (input) => replyToText({ ...input, kv }),
    update,
  });
}

function replyToPhoto(ctx: AppContext<ChatPhoto>): Promise<void> {
  const { chat } = ctx;
  const caption = chat.getPhotoCaption() ?? "";
  const photoUrl = chat.getPhotoUrl();
  const message = `${caption}\n\n${photoUrl}`;
  return sendReplies(ctx, message);
}

const replyToText = (ctx: AppContext<ChatText>) =>
  sendReplies(ctx, ctx.chat.getTextMessage());

async function sendReplies(ctx: AppContext, message: string): Promise<void> {
  const { chat } = ctx;
  const threadId = await assistantThreadIdUpsert(ctx);
  const { runId } = await assistantSendMessage(threadId, message);

  const messageIds: string[] = [];
  let shouldBreak = false;
  let loopCount = 0;
  while (true) {
    loopCount++;
    const [isRunCompleted] = await Promise.all([
      assistantTakeRequiredActions({ ctx, threadId, runId }),
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
}
