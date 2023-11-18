import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { captureAWSv3Client } from "aws-xray-sdk";
import { Table } from "sst/node/table";

import { KV } from "@bubby/core/interfaces/storage";

const client = new DynamoDBClient({});
const xrayClient = captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(xrayClient);

export const kv: KV = {
  get: async (ChannelId, Key) => {
    const input: GetCommandInput = {
      TableName: Table.KeyValues.tableName,
      Key: { ChannelId, Key },
    };

    const response = await docClient.send(new GetCommand(input));
    const value = (response.Item ?? {})["Value"];
    if (typeof value === "string") {
      return value;
    }
  },
  set: async (ChannelId, Key, Value) => {
    const input: PutCommandInput = {
      TableName: Table.KeyValues.tableName,
      Item: { ChannelId, Key, Value },
    };

    await docClient.send(new PutCommand(input));
    console.log(JSON.stringify(input, null, 2));
  },
};
