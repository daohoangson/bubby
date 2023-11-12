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

export async function replyTextChat(
  input: ReplyTextChatInput
): Promise<Reply[]> {
  const threadId = await assistantThreadIdUpsert(input);
  return generateReply(input, threadId, input.chat.getTextMessage());
}

async function generateReply(
  input: ReplyTextChatInput,
  threadId: string,
  message: string
): Promise<Reply[]> {
  console.log({ threadId, message });
  const { runId } = await assistantSendMessage(threadId, message);

  const replies: Reply[] = [];
  replies.push(...(await assistantWaitForRun({ ...input, threadId, runId })));
  replies.push(...(await assistantGetNewMessages(threadId, runId)));

  return replies;
}
