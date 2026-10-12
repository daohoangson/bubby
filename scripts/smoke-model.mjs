import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const url = "http://127.0.0.1:2000";
function invoke(prompt, previous) {
  const result = spawnSync(process.execPath,
    ["node_modules/eve/bin/eve.js", "remote", "invoke", "--url", url, ...(previous ? ["--resume"] : []), prompt],
    { encoding: "utf8", input: previous ? JSON.stringify(previous) : undefined,
      env: { ...process.env, EVE_TELEMETRY_DISABLED: "1" }, timeout: 60_000 });
  if (result.status !== 0) throw new Error("Model invocation failed. Check the server logs and provider configuration.");
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, "ready");
  assert.equal(response.outcome.status, "completed");
  return response;
}
const first = invoke("Remember this code for this conversation: mango-742. Reply only OK.");
const second = invoke("What code did I give you? Reply only with the code.", first);
assert.equal(second.outcome.message.trim(), "mango-742");
console.log("Passed: two real model turns, conversation context retained (mango-742). No Telegram messages sent.");
