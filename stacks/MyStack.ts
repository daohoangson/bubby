import {
  HttpIntegrationSubtype,
  ParameterMapping,
  MappingValue,
} from "@aws-cdk/aws-apigatewayv2-alpha";
import { Duration } from "aws-cdk-lib";
import {
  StackContext,
  Api,
  Config,
  Table,
  FunctionProps,
  Queue,
} from "sst/constructs";

export function API({ stack }: StackContext) {
  const OPENAI_API_KEY = new Config.Secret(stack, "OPENAI_API_KEY");
  const OPENAI_ASSISTANT_ID = new Config.Secret(stack, "OPENAI_ASSISTANT_ID");
  const TELEGRAM_BOT_TOKEN = new Config.Secret(stack, "TELEGRAM_BOT_TOKEN");
  const TELEGRAM_WEBHOOK_SECRET_TOKEN = new Config.Secret(
    stack,
    "TELEGRAM_WEBHOOK_SECRET_TOKEN"
  );
  const envVars = [
    OPENAI_API_KEY,
    OPENAI_ASSISTANT_ID,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET_TOKEN,
  ];

  const tableKeyValues = new Table(stack, "KeyValues", {
    fields: {
      ChannelId: "string",
      Key: "string",
      Value: "string",
    },
    primaryIndex: { partitionKey: "ChannelId", sortKey: "Key" },
  });
  const functionDefaults: FunctionProps = {
    bind: [...envVars, tableKeyValues],
  };

  const telegramWebhookTimeout = 300;
  const telegramWebhookQueue = new Queue(stack, "telegramWebhook", {
    cdk: {
      queue: {
        contentBasedDeduplication: true,
        fifo: true,
        visibilityTimeout: Duration.seconds(telegramWebhookTimeout),
      },
    },
    consumer: {
      cdk: {
        eventSource: {
          batchSize: 1,
        },
      },
      function: {
        ...functionDefaults,
        handler: "packages/functions/src/events/telegram-webhook.handler",
        timeout: telegramWebhookTimeout,
      },
    },
  });

  const api = new Api(stack, "api", {
    defaults: {
      function: {
        ...functionDefaults,
      },
    },
    routes: {
      "POST /telegram/webhook": {
        type: "aws",
        cdk: {
          integration: {
            subtype: HttpIntegrationSubtype.SQS_SEND_MESSAGE,
            parameterMapping: ParameterMapping.fromObject({
              MessageAttributes: MappingValue.custom(
                JSON.stringify({
                  XTelegramBotApiSecretToken: {
                    DataType: "String",
                    StringValue:
                      "${request.header.x-telegram-bot-api-secret-token}",
                  },
                })
              ),
              MessageBody: MappingValue.custom("$request.body"),
              MessageGroupId: MappingValue.custom(
                "$request.body.message.chat.id"
              ),
              QueueUrl: MappingValue.custom(telegramWebhookQueue.queueUrl),
            }),
          },
        },
      },
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
