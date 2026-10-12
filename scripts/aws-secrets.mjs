import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const profile = process.argv[2] || "daohoangson";
const names = ["OPENAI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET_TOKEN", "TELEGRAM_ADMIN_IDS"];
const lines = names.map((name) => {
  const response = JSON.parse(execFileSync("aws", ["ssm", "get-parameter", "--profile", profile,
    "--region", "us-east-1", "--name", `/sst/bubby/prod/Secret/${name}/value`, "--with-decryption"], { encoding: "utf8" }));
  return `${name}=${JSON.stringify(response.Parameter.Value)}`;
});
lines.push("OPENAI_MODEL=gpt-4o-mini", "TELEGRAM_BOT_USERNAME=bubby2023_bot", "TELEGRAM_ALLOWED_CHAT_IDS=", "EVE_TELEMETRY_DISABLED=1", "EVE_TRACES_CONTENT=off");
writeFileSync(".env.local", lines.join("\n") + "\n", { mode: 0o600, flag: "wx" });
console.log("Created ignored .env.local from AWS SSM. No webhook was changed.");
