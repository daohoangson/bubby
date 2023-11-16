import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import { Chat, ChatPhoto, ChatText } from "../../abstracts/chat";
import { bot } from "./telegram";
import { buildMaskedUrlForFile } from "../../abstracts/masked_url";
import { User } from "../../abstracts/user";
import { newChatAndUser } from "./constructor";

type OnXxxInput<T extends Chat> = {
  chat: T;
  user: User;
};

type HandleTelegramWebhookInput = {
  body: Update;
  onPhoto: (input: OnXxxInput<ChatPhoto>) => Promise<void>;
  onText: (input: OnXxxInput<ChatText>) => Promise<void>;
};

export async function handleTelegramWebhook({
  body,
  onPhoto,
  onText,
}: HandleTelegramWebhookInput) {
  bot.on(message("text"), async (ctx) => {
    const chatAndUser = newChatAndUser(ctx);
    const { chat, user } = chatAndUser;
    await allReplies(
      chatAndUser,
      onText({
        chat: {
          ...chat,
          getTextMessage: () => ctx.message.text,
        },
        user,
      })
    );
  });

  bot.on(message("photo"), async (ctx) => {
    const { photo } = ctx.message;
    const chatAndUser = newChatAndUser(ctx);
    const { chat, user } = chatAndUser;
    await allReplies(
      chatAndUser,
      onPhoto({
        chat: {
          ...chat,
          getPhotoCaption: () => ctx.message.caption,
          getPhotoUrl: () =>
            buildMaskedUrlForFile(
              chat.getChannelId(),
              photo[photo.length - 1].file_id
            ),
        },
        user,
      })
    );
  });

  await bot.handleUpdate(body);
}

async function allReplies(
  { chat }: ReturnType<typeof newChatAndUser>,
  handlerPromise: Promise<void>
): Promise<void> {
  await handlerPromise;
  await chat.sendFinalReply();
}
