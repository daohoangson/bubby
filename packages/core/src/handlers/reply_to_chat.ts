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
  const [threadId, photoUrl] = await Promise.all([
    assistantThreadIdUpsert(input),
    input.chat.getPhotoUrl(),
  ]);

  const caption = input.chat.getPhotoCaption() ?? "";
  const message = `${caption}\n\n${photoUrl}`;
  yield* repliesGenerator(input, threadId, message);
}

export async function* replyToText(
  input: AssistantThreadInput & {
    chat: ChatText;
  }
): AsyncGenerator<Reply> {
  const threadId = await assistantThreadIdUpsert(input);
  yield* repliesGenerator(input, threadId, input.chat.getTextMessage());
}

async function* repliesGenerator(
  input: AssistantThreadInput,
  threadId: string,
  message: string
): AsyncGenerator<Reply> {
  console.log({ threadId, message });
  const { runId } = await assistantSendMessage(threadId, message);
  yield* assistantWaitForRun({ ...input, threadId, runId });
  yield* assistantGetNewMessages(threadId, runId);
}
