import {
  AssistantThreadInput,
  assistantGetNewMessages,
  assistantIsRunCompleted,
  assistantSendMessage,
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
  while (true) {
    const [isRunCompleted] = await Promise.all([
      assistantIsRunCompleted({ ...input, threadId, runId }),
      assistantGetNewMessages(threadId, runId, messageIds).then(
        (messages) => {
          for (const message of messages) {
            console.log(JSON.stringify(message, null, 2));
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
        (reason) => console.warn(reason)
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
