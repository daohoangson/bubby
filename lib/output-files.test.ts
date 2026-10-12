import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { SandboxSession } from "eve/sandbox";
import { MAX_OUTPUT_BYTES, readOutputFile } from "./output-files.ts";

test("output files resolve workspace paths and preserve exact bytes and metadata", async () => {
  const bytes = Buffer.from('name,amount\r\n"Paper, recycled",12\r\n');
  const sandbox: Pick<SandboxSession, "readFile"> = {
    async readFile({ path }) {
      assert.equal(path, "/workspace/reports/invoice.CSV");
      return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    },
  };
  const result = await readOutputFile(sandbox, "reports/invoice.CSV");
  assert.deepEqual(result.bytes, bytes);
  assert.deepEqual(result.file, { path: "/workspace/reports/invoice.CSV", filename: "invoice.CSV",
    mediaType: "text/csv", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
});

test("invalid paths and unsupported formats are rejected before reading the sandbox", async () => {
  const sandbox: Pick<SandboxSession, "readFile"> = { async readFile() { assert.fail("Invalid output paths must not be read"); } };
  for (const path of ["../outside.csv", "/tmp/out.csv", "/workspace-two/out.csv", "/workspace", "file\0.csv"]) {
    await assert.rejects(readOutputFile(sandbox, path), /inside \/workspace/);
  }
  await assert.rejects(readOutputFile(sandbox, "line\nbreak.csv"), /line breaks/);
  await assert.rejects(readOutputFile(sandbox, "script.exe"), /Supported output formats/);
});

test("missing and empty files fail with actionable errors", async () => {
  const missing: Pick<SandboxSession, "readFile"> = { async readFile() { return null; } };
  const empty: Pick<SandboxSession, "readFile"> = {
    async readFile() { return new ReadableStream({ start(controller) { controller.close(); } }); },
  };
  await assert.rejects(readOutputFile(missing, "missing.txt"), /does not exist/);
  await assert.rejects(readOutputFile(empty, "empty.txt"), /empty/);
});

test("streaming output stops and cancels as soon as the 20 MB limit is exceeded", async () => {
  const chunk = new Uint8Array(1_000_000);
  let pulls = 0;
  let cancelled = false;
  const sandbox: Pick<SandboxSession, "readFile"> = {
    async readFile() {
      return new ReadableStream({
        pull(controller) { pulls++; controller.enqueue(chunk); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 });
    },
  };
  await assert.rejects(readOutputFile(sandbox, "large.pdf"), /20 MB limit/);
  assert.equal(pulls, Math.floor(MAX_OUTPUT_BYTES / chunk.byteLength) + 1);
  assert.equal(cancelled, true);
});
