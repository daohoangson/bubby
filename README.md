# Bubby

A personal Telegram assistant built on [Eve](https://eve.dev), using an OpenAI-compatible
Responses or Chat Completions API. The initial rebuild supports text conversations and conversation
context. Private chats require an approved user; groups require an approved chat.
Photo and screenshot questions are supported when the configured model accepts
image input. Send a photo or image document, optionally with a caption.
All text in an approved group is handled, matching Bubby's original behavior.
Telegram forum groups share one conversation per topic, including General.
Messages in a topic retain context without mentions or explicit replies; topics
and groups have separate histories. Regular groups use Eve's reply-based conversations.
Disable the bot's Group Privacy in BotFather to receive ordinary group messages.

Voice, image generation, reminders, and persistent cross-conversation memory are
not configured. The previous implementation is preserved in Git history. Its AWS
resources and DynamoDB data have not been deleted.

## Local setup

Use Node 24 and pnpm 8.15.9:

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm secrets:aws daohoangson
```

`secrets:aws` reads the existing production secrets from AWS SSM in us-east-1 and
creates `.env.local` with mode 0600. It refuses to overwrite an existing file and
does not change Telegram's webhook. Alternatively, copy `.env.example` to
`.env.local` and fill it in. Keep credentials out of Git.

The legacy OpenAI key was rejected with `401 invalid_api_key` during the rebuild
on October 12, 2026. Replace `OPENAI_API_KEY` with a working key before model tests.
`OPENAI_MODEL` defaults to `gpt-4o-mini` and can be changed independently.
For a custom provider, set `OPENAI_BASE_URL` to its API root (including `/v1`),
`OPENAI_API` to `responses` or `chat`, and `OPENAI_MODEL` to a model it serves.
`OPENAI_API_KEY` must be accepted by that provider; it need not be an OpenAI key.
The configured base URL receives the credential and conversation content.

The local configuration was verified against `https://codex-lb.daohoangson.com/v1`
using `OPENAI_API=responses` and `OPENAI_MODEL=gpt-6-luna`, including a two-turn
conversation recall test. Provider-side storage is disabled so follow-up turns
send full history instead of unsupported `item_reference` records. Its model listing does
not include `gpt-4o-mini`; set the model explicitly when using this endpoint.

`TELEGRAM_ADMIN_IDS` contains comma-separated user IDs allowed in private chats.
`TELEGRAM_ALLOWED_CHAT_IDS` contains approved group IDs; empty disables groups.

## Test before switching production

First check the code and production build:

```sh
pnpm typecheck
pnpm test
pnpm build
```

For a real model conversation without sending anything to Telegram:

```sh
pnpm dev
```

In the terminal UI, send `Remember the code mango-742. Reply OK.`, then
`What code did I give you?`. Verify that it replies `mango-742`. This tests the
provider credential, agent response, and conversation continuity.

To check webhook handling locally, start the server in one terminal:

```sh
pnpm dev:server
```

Then run in another terminal:

```sh
pnpm test:webhook
pnpm test:model
```

`test:model` sends two real prompts through Eve and asserts conversation recall.
It uses the model credentials loaded by the server and incurs model usage.

`test:webhook` checks health, invalid-secret rejection, acknowledgement of unsupported
updates, and ignored bot senders. It sends no Telegram messages and changes no
webhook. The server binds to 127.0.0.1:2000. Stop it with Ctrl-C afterward.

For an end-to-end Telegram test, create a separate test bot with BotFather, put
its token, username, and a fresh webhook secret in `.env.local`, and expose port
2000 with an HTTPS tunnel such as ngrok. Register the tunnel URL:

```sh
pnpm telegram:webhook https://YOUR-TUNNEL-HOST
```

Registration first calls Telegram `getMe` and prints the bot identity, private
thread settings, group/privacy settings, and local access configuration. Missing
features produce setup reminders; an invalid token or mismatched
`TELEGRAM_BOT_USERNAME` stops registration. Check settings without changing the
webhook at any time:

```sh
pnpm telegram:settings
```

Webhook registration also clears Telegram's default command menu: the rebuilt
agent has no slash commands, so the legacy `/thread_get` and `/thread_reset`
entries are removed. To sync the menu independently, run `pnpm telegram:commands`.
This uses the bot in `.env.local` and checks its username before modifying it.
Custom menus for specific chats or languages are not modified.

For a new bot, configure these in [@BotFather](https://t.me/BotFather):

- In its Mini App, select the bot, open Bot Settings > Threads Settings, enable
  Threaded Mode, and leave 'Disallow users to create new threads' off. Refresh
  Telegram Web afterward; sending a message at 'New Thread' creates a thread.
- Enable 'Allow Groups?' and disable Group Privacy (`/setprivacy`). Remove and
  re-add the bot to existing groups after changing privacy mode.
- Set `TELEGRAM_ADMIN_IDS` locally for private access and
  `TELEGRAM_ALLOWED_CHAT_IDS` for approved groups. Enable Topics in the group;
  converting a regular group to a supergroup can change its ID.

The API reports these bot-level flags but does not change them. Group-specific
membership, permissions, and Topics settings are not verified by this check.
See Telegram's [getMe fields](https://core.telegram.org/bots/api#user) and
[private-chat topics](https://core.telegram.org/bots/features#topics-in-private-chats).

Send two messages to the test bot from an approved account and verify continuity.
The registration command uses whichever bot token is in `.env.local`; a separate
test bot keeps Bubby's production webhook untouched. A terminal-only model test
does not verify Telegram reply delivery.

## Production switch on Vercel

1. Link a Vercel project with `pnpm exec eve link`.
2. Configure the variables from `.env.example` in its production environment.
   Use a working OpenAI key and the production Telegram credentials.
3. Run `pnpm deploy` (Eve deploys to production). Vercel builds its own Linux
   bundle; do not upload the macOS `.output` directory.
4. Check `https://YOUR-HOST/eve/v1/health`.
5. With production Telegram credentials in `.env.local`, switch the webhook:

   ```sh
   pnpm telegram:webhook https://YOUR-HOST
   ```

6. Send a real message, verify its reply, then verify a follow-up remembers context.
   Check `getWebhookInfo` and deployment logs for delivery errors.

Registration preserves pending updates (`drop_pending_updates: false`), so old
messages may produce replies after the switch. Decide how to handle that backlog
before switching. The Telegram transport acknowledges receipt before background
processing; a 200 response alone does not prove the model replied.

Keep the old AWS stack until the new bot is verified. The previous webhook URL is
`https://fpjonkgnsi.execute-api.us-east-1.amazonaws.com/telegram/webhook?v=2024072002`.
Re-registering it reverses the routing switch but restores the currently broken
implementation. Retire old AWS resources separately after a successful cutover.

Eve uses local workflow storage during development and Vercel Workflow when
hosted on Vercel. Local restart recovery requires `pnpm dev --resume`; old
DynamoDB memory and Assistant threads are not imported into the new sessions.
