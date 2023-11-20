import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import {
  Chat,
  ChatPhoto,
  ChatText,
  ChatVoice,
} from "@bubby/core/interfaces/chat";
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
  onVoice: (input: OnXxxInput<ChatVoice>) => Promise<void>;
  update: Update;
};

export async function onMessage({
  onPhoto,
  onText,
  onVoice,
  update,
}: OnMessageInput) {
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

  bot.on(message("voice"), async (ctx) => {
    const chatAndUser = newChatAndUser(ctx);
    const { chat, user } = chatAndUser;
    await allReplies(
      chatAndUser,
      onVoice({
        chat: {
          ...chat,
          getVoiceData: async () => {
            const { file_id } = ctx.message.voice;
            const url = await bot.telegram.getFileLink(file_id);
            const response = await fetch(url);
            return response.blob();
          },
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
