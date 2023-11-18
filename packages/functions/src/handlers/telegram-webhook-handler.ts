import { Config } from "sst/node/config";

import { kv } from "@bubby/aws";
import { AppContext } from "@bubby/core/interfaces/app";
import { ChatPhoto, ChatText } from "@bubby/core/interfaces/chat";
import { agent } from "@bubby/openai";
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
    update,
  });
}

function replyToPhoto(ctx: AppContext<ChatPhoto>): Promise<void> {
  const { chat } = ctx;
  const caption = chat.getPhotoCaption() ?? "";
  const photoUrl = chat.getPhotoUrl();
  const message = `${caption}\n\n${photoUrl}`;
  return respond(ctx, message);
}

const replyToText = (ctx: AppContext<ChatText>) =>
  respond(ctx, ctx.chat.getTextMessage());

const respond = (ctx: AppContext, message: string) =>
  agent.respond({ ctx, message, tools });
