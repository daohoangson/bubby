import { Context } from "telegraf";
import { message } from "telegraf/filters";
import { Update } from "telegraf/typings/core/types/typegram";

import { ChatPhoto, ChatText, Reply } from "../../abstracts/chat";
import { convertMarkdownToSafeHtml } from "./formatting";
import { bot } from "./telegram";

export type HandleTelegramWebhookInput = {
  body: Update;
  onPhoto: (chat: ChatPhoto) => AsyncGenerator<Reply>;
  onText: (chat: ChatText) => AsyncGenerator<Reply>;
};

export async function handleTelegramWebhook({
  body,
  onPhoto,
  onText,
}: HandleTelegramWebhookInput) {
  bot.on(message("text"), async (ctx) => {
    await sendReplies(ctx, () =>
      onText({
        getChannelId: () => `${ctx.chat.id}`,
        getUserId: () => `${ctx.from.id}`,
        getTextMessage: () => ctx.message.text,
      })
    );
  });

  bot.on(message("photo"), async (ctx) => {
    const { photo } = ctx.message;
    await sendReplies(ctx, () =>
      onPhoto({
        getChannelId: () => `${ctx.chat.id}`,
        getUserId: () => `${ctx.from.id}`,
        getPhotoCaption: () => ctx.message.caption,
        getPhotoUrl: () =>
          bot.telegram
            .getFileLink(photo[photo.length - 1].file_id)
            // TODO: replace URL because it contains out bot token
            .then((url) => url.toString()),
      })
    );
  });

  await bot.handleUpdate(body);
}

async function sendReplies(
  ctx: Context<Update.MessageUpdate>,
  repliesGenerator: () => AsyncGenerator<Reply>
) {
  let repliedSomething = false;
  let hasError = false;
  const errors: Error[] = [];
  const tryTo = (p: Promise<any>) =>
    p.then(
      () => (repliedSomething = true),
      (error) => {
        hasError = true;
        if (error instanceof Error) {
          errors.push(error);
        }
        console.warn(error);
      }
    );

  for await (const reply of repliesGenerator()) {
    await ctx.sendChatAction("typing");
    console.log({ chatId: ctx.chat.id, reply });
    switch (reply.type) {
      case "markdown":
        const safeHtml = convertMarkdownToSafeHtml(reply.markdown);
        await tryTo(ctx.replyWithHTML(safeHtml));
        break;
      case "photo":
        const { caption, url } = reply;
        await tryTo(ctx.replyWithPhoto({ url }, { caption }));
        break;
      case "plaintext":
        await tryTo(ctx.reply(reply.plaintext));
        break;
    }
  }

  if (!repliedSomething && hasError) {
    if (errors.length > 0) {
      await ctx.reply(`🚨 ${errors[errors.length - 1].message}`);
    } else {
      await ctx.reply("🚨 Something went wrong, please try again later.");
    }
  }
}
