# Bubby

A personal Telegram assistant built on [Eve](https://eve.dev), using an OpenAI-compatible
Responses or Chat Completions API. The initial rebuild supports text conversations and conversation
context. Private chats require an approved user; groups require an approved chat.
Photo and screenshot questions are supported when the configured model accepts
image input. Send a photo or image document, optionally with a caption.
PDF, CSV, TXT, DOCX, and XLSX uploads are also enabled (up to 20 MB).
The bot can run Node.js scripts in its conversation's sandbox to inspect documents
and calculate answers. Attach a file with a question as its caption, or send it
alone for a brief summary. Scanned PDFs need additional OCR tools;
spreadsheet formulas use saved results and are not recalculated.
The bot can also create or edit files and send them back as downloadable Telegram
documents in the current chat or topic (up to 20 MB). For example, ask it to
clean an uploaded CSV or convert it into an Excel workbook. Generated CSV, TXT,
JSON, PDF, DOCX, XLSX, and common image files can be delivered; generating a
particular format still requires suitable script libraries or model capabilities.
All text in an approved group is handled, matching Bubby's original behavior.
Telegram forum groups share one conversation per topic, including General.
Messages in a topic retain context without mentions or explicit replies; topics
and groups have separate histories. Regular groups use Eve's reply-based conversations.
Disable the bot's Group Privacy in BotFather to receive ordinary group messages.
While a turn runs, one silent status message shows activity such as installing
dependencies or working in the sandbox. It stays in the current topic, suppresses
duplicate text, limits edits to once every two seconds, and is removed when the
turn finishes, fails, or is cancelled. Status API failures do not interrupt tasks.

Voice, image generation, reminders, and persistent cross-conversation memory are
not configured. The previous implementation is preserved in Git history. Its AWS
resources and DynamoDB data have not been deleted.

## Local setup

Use Node 24, pnpm 8.15.9, and a running Docker daemon:

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
pnpm test:files
pnpm test:sandbox
```

`test:model` sends two real prompts through Eve and asserts conversation recall.
It uses the model credentials loaded by the server and incurs model usage.

`test:files` generates four small invoice fixtures (PDF, quoted CSV, DOCX, XLSX),
uploads them through the local Eve API, and asserts the extracted codes and
calculated totals as well as actual Node.js tool use. Each fresh conversation asks
the model to choose a parser, check that it is missing, install it with npm, then
use it. The test verifies those successful tool actions in order. It sends no
Telegram messages.
Fixtures and model/tool evidence are saved under `.runs/`; use
`pnpm test:files:fixtures` to generate just the files for Telegram testing.

`test:sandbox` verifies attachment and workspace continuity over multiple turns,
stops its test container, verifies recovery, and checks isolation from another
conversation. It uses the local Docker daemon and real model calls, then resets
only its own test sessions. Evidence is saved under `.runs/`.

Local scripts run in Eve Docker containers, separate from the host project and
its credentials. Fresh sandboxes have Node.js, npm, and an empty package manifest.
The agent chooses and installs missing npm dependencies in `/workspace` as needed,
then reuses them across turns in that conversation. The first task needing a package
includes its download time. Existing sandboxes may retain previously installed
packages. Scripts have network access. Write scripts under `/workspace` to resolve
its installed Node modules. File tasks use the explicit `bash`,
`read_file`, `write_file`, `glob`, and `publish_file` tools are enabled. File
publishing uses the current Telegram destination; the model cannot select another
recipient. Files are checked for size and content changes before delivery.

### Reusable skills in development

Eve's local self-modification extension is explicitly enabled in `pnpm dev` and
`pnpm dev:server`. Ask the dev bot to create or update a reusable skill. Its editing
subagent writes authored files under `agent/`, mounted at `/source`; changes remain
on disk and reload for the next user turn. `just-bash` is a host development
dependency for this editor; task libraries still install on demand inside Docker.
The editing subagent uses the configured custom model endpoint.

For example: `Create a reusable expense-report skill that creates, verifies, and
sends an Excel workbook from expense rows.` Then start another topic and ask:
`Use your expense-report skill for Paper: 12.5 and Binder: 7.25.` To refine it,
ask `Update the expense-report skill to support optional VAT`, then test in a
fresh topic so earlier loaded instructions do not affect the check.

Skills live in `agent/skills/<name>/SKILL.md` with name/description frontmatter.
They are shared authored behavior across topics, rather than personal memory.
The editor has write access to the authored agent directory, so requests can
change more than skills. Review its Git diff before shipping. This local editor
is disabled outside development; GitHub access and automatic deployment are not
configured.

To test file delivery through Telegram, ask the dev bot:

1. `Create and send sample.csv with item,amount columns and rows: Paper, recycled
   = 12.5 and Binder = 7.25. Quote the comma correctly.`
2. `Convert sample.csv to sample.xlsx with numeric amounts and a Total row using
   a SUM formula with its saved result. Reopen it to verify, then send it.`

Verify both downloadable documents arrive in the same topic. These flows were
tested in the dev bot using Safari; helper tests also verify exact upload bytes,
topic routing, file limits, and delivery error handling.

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

Production runs in the `daohoangson/bubby` Vercel project at
`https://bubby-peach.vercel.app`. The `@bubby2023_bot` webhook was switched to
`https://bubby-peach.vercel.app/eve/v1/telegram` on October 12, 2026, preserving
pending Telegram updates. Production credentials are stored in Vercel; local
`.env.local` continues to target `@bubby_dev_bot`. Private access uses the approved
user IDs from the previous AWS configuration. Private topics and user-created
threads are enabled in BotFather. Group access is currently disabled, and Group
Privacy remains enabled until approved production groups are configured.

The deployment upload excludes local credentials, runtime data, build output,
and dependencies through `.vercelignore`. Vercel installs and builds the source
on Linux. To redeploy this linked checkout, run `pnpm deploy`.

1. Link a Vercel project with `pnpm exec eve link`.
2. Configure the variables from `.env.example` in its production environment.
   Use a working OpenAI key and the production Telegram credentials.
   Hosted builds use Vercel Sandbox instead of local Docker; sandbox provisioning
   and billing must be enabled for the project. Verify file handling in the hosted
   environment before switching the production webhook.
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
