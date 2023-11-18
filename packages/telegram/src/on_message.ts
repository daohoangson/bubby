import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import { Chat, ChatPhoto, ChatText } from "@bubby/core/interfaces/chat";
import { User } from "@bubby/core/interfaces/user";
import { buildMaskedUrlForFile } from "@bubby/core/utils";
import { bot } from "./internal/telegram";
import { newChatAndUser } from "./internal/constructor";

type OnXxxInput<T extends Chat> = {
  chat: T;
  user: User;
};

type OnMessageInput = {
  onPhoto: (input: OnXxxInput<ChatPhoto>) => Promise<void>;
  onText: (input: OnXxxInput<ChatText>) => Promise<void>;
  update: Update;
};

export async function onMessage({ onPhoto, onText, update }: OnMessageInput) {
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

  await bot.handleUpdate(update);
}

async function allReplies(
  { chat }: ReturnType<typeof newChatAndUser>,
  handlerPromise: Promise<void>
): Promise<void> {
  try {
    await handlerPromise;
  } catch (error) {
    chat.onError(error);
  }
  await chat.sendFinalReply();
}
