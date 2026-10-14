import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { ScheduleDelivery, ScheduleProviderContext } from "eve/experimental/schedules";
import { createDevScheduleProvider } from "./dev-schedules.ts";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
function context(deliver: (event: ScheduleDelivery) => Promise<void>, namespace = "user1"): ScheduleProviderContext {
  return { collection: "reminders", namespace, operationId: randomUUID(),
    abortSignal: new AbortController().signal, target: { key: "bubby", deliver } };
}

test("UTC delay-style dates fire automatically on a Vietnam host and become completed", async (t) => {
  const previous = process.env.TZ;
  process.env.TZ = "Asia/Ho_Chi_Minh";
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-10-14T13:29:11Z") });
  const provider = createDevScheduleProvider();
  const sent: ScheduleDelivery[] = [];
  const ctx = () => context(async (event) => { sent.push(event); });
  const created = await provider.create(ctx(), { name: "water", payload: { text: "Drink water" },
    expression: { type: "single", at: "2026-10-14T13:31", timezone: "UTC" } });
  assert.equal(created.state, "active");
  t.mock.timers.tick(108_999);
  await settle();
  assert.equal(sent.length, 0);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].payload, { text: "Drink water" });
  assert.equal(sent[0].occurrence.scheduledAt, "2026-10-14T13:31:00.000Z");
  assert.equal((await provider.get(ctx(), "water"))?.state, "completed");
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(sent.length, 1);
  await provider.delete(ctx(), "water");
});

test("recurring local time, pause/resume, timing updates and deletion control real timer callbacks", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-10-14T01:59:00Z") });
  const provider = createDevScheduleProvider();
  const sent: ScheduleDelivery[] = [];
  const ctx = () => context(async (event) => { sent.push(event); });
  await provider.create(ctx(), { name: "daily", payload: "original",
    expression: { type: "cron", cron: "0 9 * * *", timezone: "Asia/Ho_Chi_Minh" } });
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(sent.length, 1);
  assert.equal((await provider.get(ctx(), "daily"))?.state, "active");
  await provider.disable(ctx(), "daily");
  t.mock.timers.tick(24 * 3600_000);
  await settle();
  assert.equal(sent.length, 1);
  await provider.update(ctx(), "daily", { expression: { type: "cron", cron: "* * * * *", timezone: "UTC" }, payload: "updated" });
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(sent.length, 1);
  await provider.enable(ctx(), "daily");
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(sent.length, 2);
  assert.equal(sent[1].payload, "updated");
  assert.notEqual(sent[0].occurrence.executionId, sent[1].occurrence.executionId);
  await provider.delete(ctx(), "daily");
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(sent.length, 2);
});

test("scope isolation, creation retries and invalid or past dates cannot falsely acknowledge delivery", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-10-14T02:00:00Z") });
  const provider = createDevScheduleProvider();
  const ctx = context(async () => {});
  const input = { name: "water", payload: "hello", expression: { type: "single" as const, at: "2026-10-14T09:01", timezone: "Asia/Ho_Chi_Minh" } };
  const first = await provider.create(ctx, input);
  assert.deepEqual(await provider.create(ctx, input), first);
  const other = context(async () => {}, "user2");
  assert.equal(await provider.get(other, "water"), null);
  assert.deepEqual((await provider.list(other, {})).data, []);
  await assert.rejects(provider.disable(other, "water"), /not found/);
  await assert.rejects(provider.create(context(async () => {}), { ...input, name: "past",
    expression: { type: "single", at: "2026-10-14T08:59", timezone: "Asia/Ho_Chi_Minh" } }), /future occurrence/);
  await assert.rejects(provider.update(context(async () => {}), "water", { expression: { type: "cron", cron: "invalid" } }));
  assert.deepEqual((await provider.get(ctx, "water"))?.expression, input.expression);
  await provider.delete(context(async () => {}), "water");
});

test("failed delivery pauses the reminder and logs a safe error", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: new Date("2026-10-14T02:00:00Z") });
  const log = t.mock.method(console, "error", () => {});
  const provider = createDevScheduleProvider();
  const ctx = () => context(async () => { throw new Error("secret credential-bearing URL"); });
  await provider.create(ctx(), { name: "failed", payload: "hello", expression: { type: "single", at: "2026-10-14T02:01", timezone: "UTC" } });
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal((await provider.get(ctx(), "failed"))?.state, "inactive");
  assert.equal(log.mock.callCount(), 1);
  assert.doesNotMatch(String(log.mock.calls[0].arguments[0]), /secret credential/);
  await provider.delete(ctx(), "failed");
});
