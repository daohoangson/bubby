import { Config } from "sst/node/config";

import { kv } from "@bubby/aws";
import { AppContext } from "@bubby/core/interfaces/app";
import { ChatPhoto, ChatText } from "@bubby/core/interfaces/chat";
import { agent, speech } from "@bubby/openai";
import { onMessage } from "@bubby/telegram";
import { tools } from "src/tools";

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
  return agent.respond({ ctx, message, tools });
}

async function replyToText(ctx: AppContext<ChatText>): Promise<void> {
  const text = await ctx.chat.getTextMessage();
  const message = { text };
  return agent.respond({ ctx, message, tools });
}
