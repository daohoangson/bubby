# Telegram bot powered by OpenAI assistant API

## Usage

https://t.me/bubby2023_bot

## Deployment

Required environment variables:

- `OPENAI_API_KEY` via https://platform.openai.com/api-keys
- `OPENAI_ASSISTANT_ID` via https://platform.openai.com/assistants
- `TELEGRAM_BOT_TOKEN`: use https://t.me/BotFather to create a bot
- `TELEGRAM_WEBHOOK_SECRET_TOKEN`: use https://www.random.org/passwords/ to generate a random password
- `KV_*`: create a Vercel KV database and connect to project

```shell
vercel --prod

# register webhook
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook \
  -F url=https://bubby2023.vercel.app/api/webhook \
  -F secret_token=${TELEGRAM_WEBHOOK_SECRET_TOKEN}

# check webhook status
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo
```
