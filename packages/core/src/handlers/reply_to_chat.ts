import {
  AssistantThreadInput,
  assistantGetNewMessages,
  assistantSendMessage,
  assistantThreadIdUpsert,
  assistantWaitForRun,
} from "../3rdparty";
import { ChatPhoto, ChatText, Reply } from "../abstracts/chat";

export async function* replyToPhoto(
  input: AssistantThreadInput & {
    chat: ChatPhoto;
  }
): AsyncGenerator<Reply> {
  const caption = input.chat.getPhotoCaption() ?? "";
  const photoUrl = input.chat.getPhotoUrl();
  const message = `${caption}\n\n${photoUrl}`;
  yield* repliesGenerator(input, message);
}

export const replyToText = (
  input: AssistantThreadInput & {
    chat: ChatText;
  }
) => repliesGenerator(input, input.chat.getTextMessage());

async function* repliesGenerator(
  input: AssistantThreadInput,
  message: string
): AsyncGenerator<Reply> {
  const threadId = await assistantThreadIdUpsert(input);
  const { runId } = await assistantSendMessage(threadId, message);
  yield* assistantWaitForRun({ ...input, threadId, runId });
  yield* assistantGetNewMessages(threadId, runId);
}
