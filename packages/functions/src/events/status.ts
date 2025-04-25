import { checkTelegram } from "@bubby/telegram";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";

export const handler: Handler<APIGatewayProxyEvent> = async (
  event
): Promise<APIGatewayProxyResult> => {
  const telegram = await checkTelegram();

  return {
    statusCode: 202,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram }),
  };
};
