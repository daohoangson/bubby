# Telegram bot powered by OpenAI assistant API

## Usage

https://t.me/bubby2023_bot

## Deployment

```shell
# this project uses PNPM instead of NPM
npm install --global pnpm

# install dependencies
pnpm install

# set secrets for the local stage
## create new secret key at https://platform.openai.com/api-keys
pnpm sst secrets set OPENAI_API_KEY sk-xxx 
## create new assistant at https://platform.openai.com/assistants
pnpm sst secrets set OPENAI_ASSISTANT_ID asst_xxx
## chat with https://t.me/BotFather to create a new bot
pnpm sst secrets set TELEGRAM_BOT_TOKEN '123:xxx'
## use https://www.random.org/passwords/ or similar tool to generate a random password
pnpm sst secrets set TELEGRAM_WEBHOOK_SECRET_TOKEN s3cret

# this project use SST to deploy to AWS
# use its dev command for https://docs.sst.dev/live-lambda-development
pnpm dev

# register webhook
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook \
  -F url=https://xxx.execute-api.us-east-1.amazonaws.com/api/webhook \
  -F secret_token=${TELEGRAM_WEBHOOK_SECRET_TOKEN}

# check webhook status
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo
```
