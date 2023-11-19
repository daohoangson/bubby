import OpenAI from "openai";
import { Config } from "sst/node/config";

export const assistantId = Config.OPENAI_ASSISTANT_ID;
export const openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
export const threads = openai.beta.threads;
