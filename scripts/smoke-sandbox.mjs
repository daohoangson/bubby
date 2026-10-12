import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { Client, createTextWithFileContent } from "eve/client";
import { fixtures } from "./file-fixtures.mjs";

const url = new URL(process.env.EVE_TEST_URL ?? "http://127.0.0.1:2000");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Sandbox smoke tests require a local Eve dev server.");
assert.equal(url.protocol, "http:", "Sandbox smoke tests require the local HTTP dev server.");
assert.ok(!process.env.VERCEL, "Sandbox smoke tests cannot run in Vercel.");
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", timeout: 30_000 }).trim();
const dockerEndpoint = process.env.DOCKER_HOST ?? JSON.parse(docker("context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"));
assert.ok(dockerEndpoint.startsWith("unix://"), "Sandbox smoke tests require a local Docker Unix socket.");
const client = new Client({ host: url.origin });
await client.health();
const sentinel = `sandbox-${randomUUID()}`;
const fixture = fixtures.find(file => file.filename === "invoice.csv");
assert.ok(fixture);
const expected = { sentinel, code: fixture.code, total: fixture.total };
const evidence = { target: url.origin, dockerEndpoint, expected, turns: [], containers: {}, cleanup: [] };
const sessions = [];
await mkdir(".runs", { recursive: true });
const save = () => writeFile(".runs/sandbox-smoke-results.json", JSON.stringify(evidence, null, 2));
const containersFor = sessionId => docker("ps", "-aq", "--no-trunc", "--filter", `label=eve.sandbox.tag.sessionId=${sessionId}`, "--filter", "label=eve.sandbox.role=session").split(/\s+/).filter(Boolean);
function ownedContainer(sessionId) {
  const containers = containersFor(sessionId);
  assert.equal(containers.length, 1, `Expected one Docker sandbox for test session ${sessionId}`);
  const [container] = containers;
  const inspection = JSON.parse(docker("inspect", container))[0];
  assert.equal(inspection.Config.Labels["eve.sandbox.tag.sessionId"], sessionId);
  assert.equal(inspection.Config.Labels["eve.sandbox.role"], "session");
  return { id: inspection.Id, running: inspection.State.Running };
}
async function invoke(label, session, message) {
  console.log(`Testing ${label}…`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600_000);
  try {
    const response = await session.send(message, { signal: controller.signal });
    const result = await response.result();
    evidence.turns.push({ label, sessionId: session.state.sessionId, result });
    await save();
    assert.notEqual(result.status, "failed", `${label}: session failed`);
    assert.ok(result.events.some(event => event.type === "turn.completed"), `${label}: turn did not complete`);
    const calls = result.events.flatMap(event => event.type === "actions.requested" ? event.data.actions : [])
      .filter(action => action.kind === "tool-call" && /(?:^|[.:/])bash$/.test(action.toolName));
    assert.ok(calls.some(action => typeof action.input.command === "string" && /\bnode\b/.test(action.input.command)), `${label}: no Node.js tool call`);
    const outputs = result.events.filter(event => event.type === "action.result" && calls.some(call => call.callId === event.data.result.callId)
      && event.data.status === "completed" && !event.data.result.isError && event.data.result.output.exitCode === 0);
    assert.ok(outputs.length, `${label}: no successful Node.js bash action`);
    const answer = JSON.parse((result.message ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    return { answer, calls, outputs };
  } finally {
    clearTimeout(timer);
  }
}
const readPrompt = "Run a Node.js script via bash to read /workspace/sentinel.txt and re-open the original attached invoice.csv from its sandbox attachment path. Parse CSV and sum its item amounts. The code field must be the single distinct invoice code, not a concatenation of repeated rows. Return only JSON {sentinel,code,total} using values read from disk. Do not rewrite files or answer from conversation memory.";
let failure;
try {
  const primary = (await client.sessions.create()).session;
  sessions.push(primary);
  const first = await invoke("initial attachment and workspace write", primary, createTextWithFileContent({
    bytes: fixture.bytes, filename: fixture.filename, mediaType: fixture.mediaType,
    text: `Run Node.js via bash to parse the attached CSV, sum item amounts, and write the exact text ${sentinel} into /workspace/sentinel.txt. Read the sentinel back. The code field must be the single distinct invoice code, not a concatenation of repeated rows. Return only JSON {sentinel,code,total}.`,
  }));
  assert.deepEqual(first.answer, expected);
  const initial = ownedContainer(primary.state.sessionId);
  assert.equal(initial.running, true);
  evidence.containers.primary = initial;
  const second = await invoke("attachment and workspace retained across turns", primary, readPrompt);
  assert.deepEqual(second.answer, expected);
  assert.ok(second.outputs.some(event => JSON.stringify(event.data.result.output).includes(sentinel)), "Follow-up must actually read the random sentinel through a successful tool.");
  assert.equal(ownedContainer(primary.state.sessionId).id, initial.id);

  // This exact container belongs to the test session above; never stop unrelated sandboxes.
  assert.equal(ownedContainer(primary.state.sessionId).id, initial.id);
  docker("stop", "--time", "0", initial.id);
  evidence.containers.stopped = ownedContainer(primary.state.sessionId);
  assert.equal(evidence.containers.stopped.running, false);
  await save();
  const resumed = await invoke("stopped Docker sandbox resumes with files", primary, readPrompt);
  assert.deepEqual(resumed.answer, expected);
  assert.ok(resumed.outputs.some(event => JSON.stringify(event.data.result.output).includes(sentinel)), "Resumed sandbox must read the random sentinel through a successful tool.");
  evidence.containers.resumed = ownedContainer(primary.state.sessionId);
  assert.equal(evidence.containers.resumed.id, initial.id, "Resume must restart the same Docker container.");
  assert.equal(evidence.containers.resumed.running, true);

  const isolated = (await client.sessions.create()).session;
  sessions.push(isolated);
  const other = await invoke("separate session workspace isolation", isolated,
    "Run a Node.js script via bash to check fs.existsSync('/workspace/sentinel.txt'). Do not create or modify that file. Return only JSON {exists:boolean} from the actual filesystem result.");
  assert.deepEqual(other.answer, { exists: false });
  assert.ok(other.outputs.some(event => /false/.test(event.data.result.output.stdout)), "Isolation result must come from a successful tool.");
  evidence.containers.isolated = ownedContainer(isolated.state.sessionId);
  assert.notEqual(evidence.containers.isolated.id, initial.id);
  evidence.passed = true;
} catch (error) {
  failure = error;
  evidence.error = { name: error.name, message: error.message };
} finally {
  for (const session of sessions) {
    const sessionId = session.state.sessionId;
    try {
      await session.cancel({ signal: AbortSignal.timeout(30_000) });
      await session.reset({ reason: "Local sandbox regression test finished", signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      evidence.cleanup.push({ sessionId, error: error.message });
    }
    // Reset queues cleanup; let Eve's finalizer finish before any fallback removal.
    const deadline = Date.now() + 30_000;
    let remaining = containersFor(sessionId);
    while (remaining.length && Date.now() < deadline) {
      await delay(500);
      remaining = containersFor(sessionId);
    }
    if (!remaining.length) evidence.cleanup.push({ sessionId, finalized: true });
    // A bounded fallback only touches containers bearing this test's exact session label.
    for (const container of remaining) {
      ownedContainer(sessionId);
      docker("rm", "--force", container);
      evidence.cleanup.push({ sessionId, removedContainer: container });
    }
    assert.deepEqual(containersFor(sessionId), [], `Sandbox cleanup failed for ${sessionId}`);
  }
  await save();
}
if (failure) throw failure;
console.log("Passed: attachment context, workspace retention, Docker stop/resume with the same container, and separate-session isolation. Test sessions and containers cleaned up. Evidence: .runs/sandbox-smoke-results.json.");
