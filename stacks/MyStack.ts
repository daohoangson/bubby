import {
  HttpIntegrationSubtype,
  ParameterMapping,
  MappingValue,
} from "@aws-cdk/aws-apigatewayv2-alpha";
import { StackContext, Api, EventBus, Config } from "sst/constructs";

export function API({ stack }: StackContext) {
  const TELEGRAM_WEBHOOK_SECRET_TOKEN = new Config.Secret(
    stack,
    "TELEGRAM_WEBHOOK_SECRET_TOKEN"
  );

  const bus = new EventBus(stack, "bus", {
    defaults: {
      retries: 10,
    },
  });

  const api = new Api(stack, "api", {
    defaults: {
      function: {
        bind: [bus],
      },
    },
    routes: {
      "GET /": "packages/functions/src/lambda.handler",
      "GET /todo": "packages/functions/src/todo.list",
      "POST /todo": "packages/functions/src/todo.create",

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

  bus.subscribe("todo.created", {
    handler: "packages/functions/src/events/todo-created.handler",
  });

  bus.subscribe("telegram.webhook", {
    bind: [TELEGRAM_WEBHOOK_SECRET_TOKEN],
    handler: "packages/functions/src/events/telegram-webhook.ts",
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
