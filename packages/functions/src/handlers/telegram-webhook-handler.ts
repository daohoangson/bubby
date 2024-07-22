import { Config } from "sst/node/config";

import { kv } from "@bubby/aws";
import { AppContext } from "@bubby/core/interfaces/app";
import { Chat, ChatPhoto, ChatText } from "@bubby/core/interfaces/chat";
import { agent, speech } from "@bubby/openai";
import { handleWebhook, OnXxxInput } from "@bubby/telegram";
import { tools } from "src/tools";
import { User } from "@bubby/core/interfaces/user";
import { AgentMessage } from "@bubby/core/interfaces/ai";

class AppContextImpt<T extends Chat> implements AppContext<T> {
  public readonly chat: T;
  public readonly messages: AgentMessage[] = [];
  public readonly user: User;

  private onNewMessageHandlers: Array<
    Parameters<AppContext["onNewMessage"]>[0]
  > = [];

  constructor(input: OnXxxInput<T>) {
    this.chat = input.chat;
    this.user = input.user;
  }

  get kv() {
    return kv;
  }

  get tools() {
    return tools;
  }

  async pushMessage(message: AgentMessage): Promise<void> {
    this.messages.push(message);
    for (const handler of this.onNewMessageHandlers) {
      await handler(message);
    }
  }

  onNewMessage(handler: (message: AgentMessage) => Promise<void>): void {
    this.onNewMessageHandlers.push(handler);
  }
}

export async function handleTelegramWebhook(secretToken: string, update: any) {
  const expectedSecretToken = Config.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (secretToken !== expectedSecretToken) {
    console.warn("Unrecognized secret token", { secretToken });
    return;
  }

  await handleWebhook({
    onPhoto: (input) => replyToPhoto(new AppContextImpt(input)),
    onText: (input) => replyToText(new AppContextImpt(input)),
    speech,
    update,
  });
}

async function replyToPhoto(ctx: AppContext<ChatPhoto>): Promise<void> {
  const { chat } = ctx;
  const message = {
    imageUrl: await chat.getPhotoUrl(),
    text: chat.getPhotoCaption() ?? "",
  };
  return agent.respond({ ctx, message });
}

async function replyToText(ctx: AppContext<ChatText>): Promise<void> {
  const text = await ctx.chat.getTextMessage();
  const message = { text };
  return agent.respond({ ctx, message });
}
