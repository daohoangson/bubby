import assert from "node:assert/strict";
import test from "node:test";
import type { MemoryNamespaceContext } from "eve/memory";
import memory from "./supermemory.ts";

test("shared memory namespace survives dev source snapshots and separates production", async (t) => {
  const previous = process.env.VERCEL_ENV;
  t.after(() => {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  });
  const resolve: (context: MemoryNamespaceContext) => string = memory.namespace;
  const first = { appRoot: "/workspace/.eve/dev-runtime/snapshots/first/source", node: "root", slot: "supermemory" };
  const rebuilt = { ...first, appRoot: "/workspace/.eve/dev-runtime/snapshots/rebuilt/source" };
  delete process.env.VERCEL_ENV;
  assert.equal(await resolve(first), "bubby-dev");
  assert.equal(await resolve(rebuilt), "bubby-dev");
  process.env.VERCEL_ENV = "preview";
  assert.equal(await resolve(rebuilt), "bubby-dev");
  process.env.VERCEL_ENV = "production";
  assert.equal(await resolve(first), "bubby-production");
  assert.equal(await resolve(rebuilt), "bubby-production");
  assert.equal(memory.scope, "bubby-shared-v1");
});
