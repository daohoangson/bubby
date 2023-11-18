import { Handler } from "aws-lambda";

import { setupTelegram } from "@bubby/telegram";

export type ScriptEvent = {
  params: {
    apiUrl: string;
    scriptVersion: string;
  };
};

export const createOrUpdate: Handler<ScriptEvent> = async (event) => {
  const { apiUrl, scriptVersion } = event.params;
  await setupTelegram({
    webhookUrl: `${apiUrl}/telegram/webhook?v=${scriptVersion}`,
  });
};
