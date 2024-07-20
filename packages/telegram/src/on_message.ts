import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import { Speech } from "@bubby/core/interfaces/ai";
import * as core from "@bubby/core/interfaces/chat";
import { Chat, ChatPhoto, ChatText, ChatVoice } from "./internal/chat";
import { bot } from "./internal/telegram";
import { User } from "./internal/user";
import { commands } from "./internal/commands";

type OnXxxInput<T extends core.Chat> = {
  chat: T;
  user: User;
};

type OnMessageInput = {
  onPhoto: (input: OnXxxInput<core.ChatPhoto>) => Promise<void>;
  onText: (input: OnXxxInput<core.ChatText>) => Promise<void>;
  speech: Speech;
  update: Update;
};

export async function onMessage({
  onPhoto,
  onText,
  speech,
  update,
}: OnMessageInput) {
  for (const command of commands) {
    bot.command(command.command, command.handler);
  }

  bot.on(message("text"), async (ctx) => {
    const user = new User(ctx);
    const chat = new ChatText(ctx, user);
    await allReplies(chat, onText({ chat, user }));
  });

  bot.on(message("photo"), async (ctx) => {
    const user = new User(ctx);
    const chat = new ChatPhoto(ctx, user);
    await allReplies(chat, onPhoto({ chat, user }));
  });

  bot.on(message("voice"), async (ctx) => {
    const user = new User(ctx);
    const chat = new ChatVoice(ctx, user, speech);
    await allReplies(chat, onText({ chat, user }));
  });

  await bot.handleUpdate(update);
}

async function allReplies(
  chat: Pick<Chat, "onError" | "replySendFinal">,
  promise: Promise<void>
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    chat.onError(error);
  }
  await chat.replySendFinal();
}
