import { randomUUID } from "node:crypto";
import { Cron } from "croner";
import type { ScheduleProvider, ScheduleProviderContext } from "eve/experimental/schedules";
import type { ScheduleExpression, ScheduleRecord } from "eve/experimental/schedules";

type Entry = { record: ScheduleRecord; payload: unknown; context: ScheduleProviderContext; job: Cron };

/** Process-local scheduling for standalone eve dev (the bundled test provider has no timers). */
export function createDevScheduleProvider(): ScheduleProvider {
  const entries = new Map<string, Entry>();
  const operations = new Map<string, unknown>();
  const prefix = (ctx: ScheduleProviderContext) => JSON.stringify([ctx.collection, ctx.namespace]);
  const key = (ctx: ScheduleProviderContext, name: string) => `${prefix(ctx)}:${name}`;
  function requireEntry(ctx: ScheduleProviderContext, name: string): Entry {
    const entry = entries.get(key(ctx, name));
    if (!entry) throw new Error("Reminder not found in this user's schedules.");
    return entry;
  }
  function once<T>(ctx: ScheduleProviderContext, action: () => T): T {
    const id = `${prefix(ctx)}:${ctx.operationId}`;
    if (operations.has(id)) return operations.get(id) as T;
    const result = action();
    operations.set(id, result);
    // Bound the process-local retry receipts independently of active schedules.
    if (operations.size > 1000) operations.delete(operations.keys().next().value!);
    return result;
  }
  function projection(entry: Entry): ScheduleRecord {
    return structuredClone(entry.record);
  }
  async function dispatch(entry: Entry, executionId: string, scheduledAt: string) {
    if (!entry.context.target.deliver) throw new Error("Dev scheduler has no delivery callback.");
    await entry.context.target.deliver({ payload: entry.payload, occurrence: {
      executionId, scheduledAt, name: entry.record.name, scheduleId: entry.record.scheduleId,
    } });
  }
  function makeJob(expression: ScheduleExpression, entry: () => Entry): Cron {
    if (expression.type === "cron" && expression.jitter !== undefined) {
      throw new Error("Dev reminders do not support jitter; omit it from the schedule.");
    }
    const job = new Cron(expression.type === "single" ? expression.at : expression.cron, {
      timezone: expression.timezone ?? "UTC", paused: true, unref: true, protect: true,
    }, async () => {
      const current = entry();
      if (current.record.state !== "active") return;
      try {
        await dispatch(current, randomUUID(), new Date().toISOString());
        if (current.record.expression.type === "single") {
          current.record = { ...current.record, state: "completed", updatedAt: Date.now() };
        }
      } catch {
        // Preserve the failed reminder for inspection and explicit retry. Do not expose API credentials.
        current.job.pause();
        current.record = { ...current.record, state: "inactive", updatedAt: Date.now() };
        console.error(`[bubby:reminders] Dev delivery failed for ${current.record.name}; reminder paused.`);
      }
    });
    if (!job.nextRun()) {
      job.stop();
      throw new Error("Reminder must have a future occurrence. Check its date and timezone.");
    }
    return job;
  }
  return {
    kind: "bubby-dev",
    async create(ctx, input) {
      return once(ctx, () => {
        if (entries.has(key(ctx, input.name))) throw new Error("Reminder name already exists.");
        let entry: Entry;
        const job = makeJob(input.expression, () => entry);
        entry = { payload: input.payload, context: ctx, job, record: {
          name: input.name, scheduleId: `dev_${randomUUID()}`, expression: structuredClone(input.expression),
          state: "active", createdAt: Date.now(), updatedAt: Date.now(),
        } };
        entries.set(key(ctx, input.name), entry);
        job.resume();
        return projection(entry);
      });
    },
    async get(ctx, name) {
      const entry = entries.get(key(ctx, name));
      return entry ? projection(entry) : null;
    },
    async list(ctx, query) {
      const offset = Number(query.cursor ?? 0), limit = query.limit ?? 20;
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("Invalid reminder pagination.");
      }
      const all = [...entries].filter(([id]) => id.startsWith(`${prefix(ctx)}:`))
        .map(([, entry]) => projection(entry)).sort((a, b) => a.name.localeCompare(b.name));
      return { data: all.slice(offset, offset + limit), cursor: offset + limit < all.length ? String(offset + limit) : null };
    },
    async update(ctx, name, patch) {
      return once(ctx, () => {
        const entry = requireEntry(ctx, name);
        if (patch.expression) {
          const job = makeJob(patch.expression, () => entry);
          entry.job.stop();
          entry.job = job;
          entry.record = { ...entry.record, expression: structuredClone(patch.expression) };
          if (entry.record.state === "active") job.resume();
        }
        if (patch.payload !== undefined) entry.payload = patch.payload;
        entry.context = ctx;
        entry.record = { ...entry.record, updatedAt: Date.now() };
        return projection(entry);
      });
    },
    async enable(ctx, name) {
      return once(ctx, () => {
        const entry = requireEntry(ctx, name);
        if (!entry.job.nextRun()) throw new Error("Reminder has no future occurrence; reschedule it first.");
        entry.record = { ...entry.record, state: "active", updatedAt: Date.now() };
        entry.context = ctx;
        entry.job.resume();
        return projection(entry);
      });
    },
    async disable(ctx, name) {
      return once(ctx, () => {
        const entry = requireEntry(ctx, name);
        entry.job.pause();
        entry.record = { ...entry.record, state: "inactive", updatedAt: Date.now() };
        return projection(entry);
      });
    },
    async invoke(ctx, name) {
      await once(ctx, () => dispatch(requireEntry(ctx, name), `manual_${ctx.operationId}`, new Date().toISOString()));
    },
    async delete(ctx, name) {
      return once(ctx, () => {
        const entry = entries.get(key(ctx, name));
        entry?.job.stop();
        return entries.delete(key(ctx, name));
      });
    },
  };
}

// Authored modules may be evaluated more than once in the dev worker. Share both records and timers.
const providerKey = Symbol.for("bubby.dev-reminders.provider.v1");
export function devScheduleProvider(): ScheduleProvider {
  const shared = globalThis as typeof globalThis & { [providerKey]?: ScheduleProvider };
  return shared[providerKey] ??= createDevScheduleProvider();
}
