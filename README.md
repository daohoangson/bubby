# Bubby

A personal assistant for Telegram and Zalo, built on Eve with an OpenAI-compatible
model, sandbox tools, and Supermemory.

Telegram supports photos and documents up to 20 MB, including generated files.
Zalo supports text and incoming photos. The agent can install npm packages and
run scripts in an isolated sandbox. Voice, image generation, and
cross-posting are not configured.

## Development

Requires Node 24, pnpm 8.15.9, and Docker for sandbox tasks.

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
```

Create `.env.local` from `.env.example` and fill in the credentials and allowlists.
Use separate development bots. `.env.local` is ignored by Git.

```sh
pnpm dev            # Server and terminal UI
pnpm dev:server     # Server only, http://127.0.0.1:2000
```

Use `pnpm dev --resume` to recover local conversations after restarting.
Local sandboxes use Docker; production uses Vercel Sandbox.

## Bot setup

Private chats require an allowed user ID; groups require an allowed chat ID.
Empty allowlists disable access. Set the corresponding `TELEGRAM_ALLOWED_*`
or `ZALO_ALLOWED_*` variables from `.env.example`.

Allowed users can create one-time and recurring text reminders, list them, change
their timing, pause/resume them, or cancel them through chat. Times default to
`Asia/Ho_Chi_Minh`. Reminders return to the originating chat/topic, and users manage
only their own reminders. Removed users/chats cannot receive reminders. Delivery
retries can repeat a message. Reminders send saved text; they do not run agent tasks.
Eve's experimental Vercel Schedules provider persists reminders in production
using Vercel OIDC. Preview and self-hosted scheduling are unsupported. Under
`pnpm dev`, a process-local Croner scheduler fires reminders in their configured
timezone. Reminders are lost on restart or worker reload, including when using
`--resume`. Dev delivery failures pause the reminder and log an error; cron jitter
is unsupported in dev.

**Telegram:** enable Threaded Mode and user-created threads in BotFather.
For groups, enable Allow Groups, disable Group Privacy, and enable group Topics.
Private messages without a thread ID are ignored; resend affected opening
messages inside the topic. Approved forum groups accept General messages.

**Zalo:** create a bot in Zalo Bot Manager. Before registering its webhook,
run `pnpm zalo:updates` and send it a message to discover your user ID.
User IDs differ between bots. Zalo groups only forward mentions and replies.

Expose the local server through an HTTPS tunnel, then register each dev bot:

```sh
pnpm telegram:webhook https://YOUR-TUNNEL-HOST
pnpm zalo:webhook https://YOUR-TUNNEL-HOST
```

These commands use `.env.local` and verify registration. Telegram registration
also checks settings and clears the command menu. Use `pnpm telegram:settings`
to check settings without changing the webhook.

## Conversations and memory

Telegram forum/private topics and Zalo chats keep separate conversation histories.
Supermemory automatically saves and recalls shared knowledge across all trusted
users, channels, and groups. Anyone allowed to use the bot can update or forget it.

Memory uses the shared scope `bubby-shared-v1` with stable namespaces:
`bubby-dev` for local/preview and `bubby-production` for production.
Supermemory displays hashed container tags derived from those values.

Eve's built-in editor can update local agent files during development. In
production, only the owner's private Telegram account can request draft GitHub
PRs through the managed GitHub App. Review changes before merging.
See [patches/README.md](patches/README.md) for the custom-model inheritance patch.

## Checks

```sh
pnpm typecheck
pnpm test
EVE_DEV=1 pnpm build
```

With the local server running, `pnpm test:model`, `pnpm test:files`, and
`pnpm test:sandbox` exercise real model and sandbox behavior. They incur model
usage and save evidence under `.runs/`. `pnpm test:webhook` checks Telegram
request handling without sending messages.

## Production

Vercel project `daohoangson/bubby` serves `https://bubby-peach.vercel.app`.
Set `AI_GATEWAY_MODEL` to a Gateway model ID to use Vercel OIDC authentication;
leave it empty to use the `OPENAI_*` provider configuration.
Configure the Production environment using `.env.example`: mark API keys,
bot tokens, and webhook secrets Sensitive; keep other settings as normal variables.
Production Telegram credentials must remain separate from the dev bot's.

```sh
git push origin main
```

Vercel builds automatically. The GitHub Actions `check` job must pass before
production domains switch to the deployment. Verify `/eve/v1/health` afterward.
Register webhooks only when changing a bot or its callback URL, using credentials
for that bot. Existing registrations survive ordinary deployments.
