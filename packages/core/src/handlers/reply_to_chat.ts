import {
  assistantGetNewMessages,
  assistantSendMessage,
  assistantTakeRequiredActions,
  assistantThreadIdUpsert,
} from "../3rdparty";
import { ChatPhoto, ChatText } from "../abstracts/chat";
import { ChatContext } from "../abstracts/context";

export function replyToPhoto(ctx: ChatContext<ChatPhoto>): Promise<void> {
  const { chat } = ctx;
  const caption = chat.getPhotoCaption() ?? "";
  const photoUrl = chat.getPhotoUrl();
  const message = `${caption}\n\n${photoUrl}`;
  return sendReplies(ctx, message);
}

export const replyToText = (ctx: ChatContext<ChatText>) =>
  sendReplies(ctx, ctx.chat.getTextMessage());

async function sendReplies(ctx: ChatContext, message: string): Promise<void> {
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
