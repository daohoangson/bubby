import {
  HttpIntegrationSubtype,
  ParameterMapping,
  MappingValue,
} from "@aws-cdk/aws-apigatewayv2-alpha";
import {
  StackContext,
  Api,
  EventBus,
  Config,
  Table,
  FunctionProps,
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

  const bus = new EventBus(stack, "bus", {
    defaults: {
      retries: 10,
    },
  });
  const tableKeyValues = new Table(stack, "KeyValues", {
    fields: {
      ChannelId: "string",
      Key: "string",
      Value: "string",
    },
    primaryIndex: { partitionKey: "ChannelId", sortKey: "Key" },
  });
  const functionDefaults: FunctionProps = {
    bind: [bus, ...envVars, tableKeyValues],
    timeout: 300,
  };

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
            subtype: HttpIntegrationSubtype.EVENTBRIDGE_PUT_EVENTS,
            parameterMapping: ParameterMapping.fromObject({
              EventBusName: MappingValue.custom(bus.eventBusName),
              DetailType: MappingValue.custom("telegram.webhook"),
              Detail: MappingValue.custom("$request.body"),
              Source: MappingValue.requestHeader(
                "x-telegram-bot-api-secret-token"
              ),
            }),
          },
        },
      },
    },
  });

  bus.subscribe(
    "telegram.webhook",
    {
      ...functionDefaults,
      handler: "packages/functions/src/events/telegram-webhook.handler",
    },
    {
      retries: 0,
    }
  );

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
