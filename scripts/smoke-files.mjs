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
        text: "Local file capability test in a fresh sandbox. Choose a suitable parsing dependency yourself. First check whether it is available using Node require.resolve and print MISSING if unavailable. Install the missing dependency with npm in /workspace. Use separate bash calls for the dependency check, installation, and parsing. Read the attached file using a Node.js script in the sandbox via bash. Extract the invoice code and calculate the sum of item amounts (exclude an existing Total row). Do not infer from the filename. Return only JSON with fields code (string) and total (number).",
      }),
    });
    session = created.session;
    const result = await created.response.result();
    const record = { filename: fixture.filename, expected: { code: fixture.code, total: fixture.total }, result };
    evidence.push(record);
    await writeFile(".runs/file-smoke-results.json", JSON.stringify(evidence, null, 2));
    assert.notEqual(result.status, "failed", `${fixture.filename}: session failed`);
    assert.ok(result.events.some(event => event.type === "turn.completed"), `${fixture.filename}: turn did not complete`);
    const bashCalls = result.events.flatMap((event, index) => event.type === "actions.requested"
      ? event.data.actions.filter(action => action.kind === "tool-call" && /(?:^|[.:/])bash$/.test(action.toolName))
        .map(action => ({ ...action, requestedAt: index })) : []);
    const successfulCalls = bashCalls.flatMap(call => {
      const completedAt = result.events.findIndex(event => event.type === "action.result"
        && event.data.result.callId === call.callId && !event.data.result.isError
        && event.data.status === "completed" && event.data.result.output.exitCode === 0);
      if (completedAt < 0 || typeof call.input.command !== "string") return [];
      return [{ ...call, command: call.input.command, completedAt, output: result.events[completedAt].data.result.output }];
    });
    const install = successfulCalls.find(call => /\bnpm\s+(?:install|i|add)\b/.test(call.command));
    assert.ok(install, `${fixture.filename}: no successful npm install action`);
    const missing = successfulCalls.find(call => call.completedAt < install.requestedAt
      && /require\.resolve/.test(call.command) && /MISSING/.test(call.output.stdout));
    assert.ok(missing, `${fixture.filename}: no prior check proving the chosen dependency was missing`);
    const parsing = successfulCalls.find(call => call.requestedAt > install.completedAt && /\bnode(?:\s|$)/.test(call.command)
      && typeof call.output.stdout === "string" && call.output.stdout.includes(fixture.code));
    assert.ok(parsing, `${fixture.filename}: no successful Node parsing action after npm install`);
    record.toolEvidence = { missingCommand: missing.command, missingOutput: missing.output,
      installCommand: install.command, installOutput: install.output,
      parsingCommand: parsing.command, parsingOutput: parsing.output };
    await writeFile(".runs/file-smoke-results.json", JSON.stringify(evidence, null, 2));
    const answer = JSON.parse((result.message ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    assert.deepEqual(answer, { code: fixture.code, total: fixture.total }, `${fixture.filename}: incorrect extracted content or calculation`);
    console.log(`Passed ${fixture.filename}: ${answer.code}, total ${answer.total}, missing dependency checked, npm install and Node parsing succeeded.`);
  } catch (error) {
    await session?.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    await session?.reset({ reason: "Local file smoke test finished" }).catch(() => {});
  }
}
console.log("Passed all four file formats through the real local Eve model and script tools. Evidence: .runs/file-smoke-results.json. No Telegram messages sent.");
