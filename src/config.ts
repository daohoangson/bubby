import { VercelRequest } from "@vercel/node";
import OpenAI from "openai";
import { Telegraf } from "telegraf";

export const assistantId = process.env.OPENAI_ASSISTANT_ID ?? "";
export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const threads = openai.beta.threads;

export function verifySecretToken(req: VercelRequest) {
  return (
    req.headers["x-telegram-bot-api-secret-token"] ===
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN
  );
}
