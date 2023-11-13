import {
  AssistantThreadInput,
  assistantGetNewMessages,
  assistantSendMessage,
  assistantTakeRequiredActions,
  assistantThreadIdUpsert,
} from "../3rdparty";
import { ChatPhoto, ChatText } from "../abstracts/chat";

export function replyToPhoto(
  input: AssistantThreadInput & {
    chat: ChatPhoto;
  }
): Promise<void> {
  const caption = input.chat.getPhotoCaption() ?? "";
  const photoUrl = input.chat.getPhotoUrl();
  const message = `${caption}\n\n${photoUrl}`;
  return sendReplies(input, message);
}

export const replyToText = (
  input: AssistantThreadInput & {
    chat: ChatText;
  }
) => sendReplies(input, input.chat.getTextMessage());

async function sendReplies(
  input: AssistantThreadInput,
  message: string
): Promise<void> {
  const threadId = await assistantThreadIdUpsert(input);
  const { runId } = await assistantSendMessage(threadId, message);

  const messageIds: string[] = [];
  let shouldBreak = false;
  let loopCount = 0;
  while (true) {
    loopCount++;
    const [isRunCompleted] = await Promise.all([
      assistantTakeRequiredActions({ ...input, threadId, runId }),
      assistantGetNewMessages(threadId, runId, messageIds).then(
        (messages) => {
          for (const message of messages) {
            console.log(JSON.stringify({ loopCount, message }, null, 2));
            for (const messageContent of message.content) {
              if (messageContent.type === "text") {
                const markdown = messageContent.text.value;
                if (markdown.length > 0) {
                  messageIds.push(message.id);
                  input.chat.reply({ type: "markdown", markdown });
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
