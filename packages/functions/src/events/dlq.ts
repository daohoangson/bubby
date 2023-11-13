import { Handler, SQSEvent } from "aws-lambda";

export const handler: Handler<SQSEvent> = async ({ Records }) => {
  for (const record of Records) {
    console.log(JSON.stringify(record, null, 2));
  }
};
