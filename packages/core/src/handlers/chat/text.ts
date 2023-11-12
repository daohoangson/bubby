import {
  AssistantThreadInput,
  assistantGetNewMessages,
  assistantSendMessage,
  assistantThreadIdUpsert,
  assistantWaitForRun,
} from "../../3rdparty";
import { ChatText, Reply } from "../../abstracts/chat";

export type ReplyTextChatInput = AssistantThreadInput & {
  chat: ChatText;
};

export async function* replyTextChat(
  input: ReplyTextChatInput
): AsyncGenerator<Reply> {
  const threadId = await assistantThreadIdUpsert(input);
  yield* generateReply(input, threadId, input.chat.getTextMessage());
}

async function* generateReply(
  input: ReplyTextChatInput,
  threadId: string,
  message: string
): AsyncGenerator<Reply> {
  console.log({ threadId, message });
  const { runId } = await assistantSendMessage(threadId, message);
  yield* assistantWaitForRun({ ...input, threadId, runId });
  yield* assistantGetNewMessages(threadId, runId);
}
