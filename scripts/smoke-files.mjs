import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Client, createTextWithFileContent } from "eve/client";
import { fixtures, writeFixtures } from "./file-fixtures.mjs";

const url = process.env.EVE_TEST_URL ?? "http://127.0.0.1:2000";
assert.ok(["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname), "File smoke tests must target a local dev server.");
const client = new Client({ host: url });
await client.health();
await writeFixtures();
await mkdir(".runs", { recursive: true });
const evidence = [];
for (const fixture of fixtures) {
  console.log(`Testing ${fixture.filename} through the local Eve agent…`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000);
  let session;
  try {
    const created = await client.sessions.create({
      signal: controller.signal,
      message: createTextWithFileContent({
        bytes: fixture.bytes, filename: fixture.filename, mediaType: fixture.mediaType,
        text: "Local file capability test. Read the attached file using a Node.js script in the sandbox via bash. Extract the invoice code and calculate the sum of item amounts (exclude an existing Total row). Do not infer from the filename. Return only JSON with fields code (string) and total (number).",
      }),
    });
    session = created.session;
    const result = await created.response.result();
    evidence.push({ filename: fixture.filename, expected: { code: fixture.code, total: fixture.total }, result });
    await writeFile(".runs/file-smoke-results.json", JSON.stringify(evidence, null, 2));
    assert.notEqual(result.status, "failed", `${fixture.filename}: session failed`);
    assert.ok(result.events.some(event => event.type === "turn.completed"), `${fixture.filename}: turn did not complete`);
    const bashCalls = result.events.flatMap(event => event.type === "actions.requested" ? event.data.actions : [])
      .filter(action => action.kind === "tool-call" && /(?:^|[.:/])bash$/.test(action.toolName));
    assert.ok(bashCalls.some(action => typeof action.input.command === "string" && /\bnode\b/.test(action.input.command)), `${fixture.filename}: no Node.js script tool call`);
    assert.ok(result.events.some(event => event.type === "action.result"
      && bashCalls.some(action => action.callId === event.data.result.callId)
      && !event.data.result.isError && event.data.status === "completed"
      && event.data.result.output.exitCode === 0), `${fixture.filename}: no successful bash action`);
    const answer = JSON.parse((result.message ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    assert.deepEqual(answer, { code: fixture.code, total: fixture.total }, `${fixture.filename}: incorrect extracted content or calculation`);
    console.log(`Passed ${fixture.filename}: ${answer.code}, total ${answer.total}, Node.js tool used.`);
  } catch (error) {
    await session?.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    await session?.reset({ reason: "Local file smoke test finished" }).catch(() => {});
  }
}
console.log("Passed all four file formats through the real local Eve model and script tools. Evidence: .runs/file-smoke-results.json. No Telegram messages sent.");
