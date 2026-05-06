import path from "node:path";
import { Effect } from "effect";
import {
  ActivityEventSchema,
  ActivityExportSchema,
  type ActivityEvent,
  type ActivityExportTarget,
  ActivityQuerySchema
} from "../domain/contracts";
import { EntryWorkflowError, invalidInput } from "../domain/errors";
import { relativeToEntry, resolveConfig, todayParts } from "../domain/paths";
import { hashObject } from "../domain/render";
import { Clock, FileSystem } from "../services/context";
import { writeActivityFact } from "./activity-store";

export function appendActivity(input: {
  entryRoot?: string;
  deviceName?: string;
  event: ActivityEvent["event"];
  project?: string;
  summary: string;
  lane?: string;
}): Effect.Effect<{ eventFile: string; activityEvent: ActivityEvent; humanSummaryZh: string }, EntryWorkflowError, FileSystem | Clock> {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot, deviceName: input.deviceName });
    const fs = yield* FileSystem;
    const clock = yield* Clock;
    const now = yield* clock.now();
    yield* fs.ensureDir(config.entryRoot);
    const parts = todayParts(now);
    const safeDevice = config.deviceName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const eventFile = path.join(config.entryRoot, "activity", "events", safeDevice, parts.yyyy, parts.mm, `${parts.dd}.jsonl`);
    const eventBase = {
      ts: now.toISOString(),
      device: config.deviceName,
      event: input.event,
      project: input.project,
      lane: input.lane,
      summary: input.summary,
      raw_ref: relativeToEntry(config, eventFile),
      source: "foyer activity append",
      parents: [],
      data: {}
    };
    const digest = hashObject(eventBase);
    const activityEvent: ActivityEvent = {
      id: `evt_${digest.slice(0, 24)}`,
      ...eventBase,
      hash: `sha256:${digest}`
    };
    yield* writeActivityFact({ config, eventFile, event: activityEvent });
    return {
      eventFile,
      activityEvent,
      humanSummaryZh: `已追加 activity event：${input.event}`
    };
  });
}

export function queryActivity(input: unknown): Effect.Effect<ActivityEvent[], EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const parsed = ActivityQuerySchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));
    const query = parsed.data;
    const config = resolveConfig({ entryRoot: query.entryRoot });
    const fs = yield* FileSystem;
    const eventsRoot = path.join(config.entryRoot, "activity", "events");
    if (!(yield* fs.exists(eventsRoot))) return [];
    const files = (yield* fs.listFiles(eventsRoot)).filter((file) => file.endsWith(".jsonl")).sort();
    const events: ActivityEvent[] = [];

    for (const file of files) {
      const content = yield* fs.readFile(file);
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          continue;
        }
        const event = ActivityEventSchema.safeParse(raw);
        if (!event.success) continue;
        if (query.project && event.data.project !== query.project) continue;
        if (query.event && event.data.event !== query.event) continue;
        if (query.since && event.data.ts < query.since) continue;
        events.push(event.data);
      }
    }

    return events.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-query.limit);
  });
}

export function activityContext(input: {
  entryRoot?: string;
  project: string;
  budget?: number;
  format?: "markdown" | "json";
}): Effect.Effect<string | { project: string; events: ActivityEvent[] }, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const events = yield* queryActivity({
      entryRoot: input.entryRoot,
      project: input.project,
      limit: 200
    });
    if (input.format === "json") return { project: input.project, events };

    const lines = [
      `# ${input.project} activity context`,
      "",
      "## 最近事实",
      ...events.map((event) => `- ${event.ts} ${event.event}: ${event.summary} (${event.raw_ref ?? event.id})`)
    ];
    const markdown = lines.join("\n") + "\n";
    const budget = input.budget ?? 6000;
    return markdown.length > budget ? `${markdown.slice(0, budget)}\n\n<!-- 已按预算截断 -->\n` : markdown;
  });
}

export function exportActivity(input: unknown): Effect.Effect<
  { target: ActivityExportTarget; out: string; files: string[]; humanSummaryZh: string },
  EntryWorkflowError,
  FileSystem
> {
  return Effect.gen(function* () {
    const parsed = ActivityExportSchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));

    const request = parsed.data;
    const config = resolveConfig({ entryRoot: request.entryRoot });
    const scopeProject = request.scope.startsWith("project:") ? request.scope.slice("project:".length) : undefined;
    const events = yield* queryActivity({
      entryRoot: config.entryRoot,
      project: scopeProject,
      limit: 1000
    });
    const fs = yield* FileSystem;
    const out = request.out ?? defaultExportOut(config.entryRoot, request.scope, request.target);

    if (request.target === "graphify-corpus") {
      const file = path.join(out, `${scopeProject ?? "all-projects"}.md`);
      yield* fs.writeFile(file, renderEventsMarkdown(scopeProject ?? request.scope, events));
      yield* writeExportCursor(config.entryRoot, request.target, request.scope, events);
      return {
        target: request.target,
        out,
        files: [file],
        humanSummaryZh: "已导出 graphify Markdown corpus。"
      };
    }

    if (request.target === "hyperextract-input") {
      const file = request.out ?? out;
      yield* fs.writeFile(file, renderHyperExtractInput(scopeProject ?? request.scope, events));
      yield* writeExportCursor(config.entryRoot, request.target, request.scope, events);
      return {
        target: request.target,
        out: file,
        files: [file],
        humanSummaryZh: "已导出 Hyper-Extract Markdown input。"
      };
    }

    if (request.target === "hyperextract-ka") {
      const file = request.out ?? out;
      yield* fs.writeFile(file, `${JSON.stringify(renderKnowledgeAbstract(scopeProject ?? request.scope, events), null, 2)}\n`);
      yield* writeExportCursor(config.entryRoot, request.target, request.scope, events);
      return {
        target: request.target,
        out: file,
        files: [file],
        humanSummaryZh: "已生成最小 Hyper-Extract Knowledge Abstract 派生物。"
      };
    }

    if (request.target === "fts-index") {
      const records = events.map((event) => ({
        event_id: event.id,
        project: event.project,
        lane: event.lane,
        ts: event.ts,
        summary: event.summary,
        raw_text: `${event.event} ${event.summary}`,
        raw_ref: event.raw_ref,
        source_path: event.raw_ref
      }));
      const file = request.out ?? out;
      yield* fs.writeFile(file, JSON.stringify({ records }, null, 2));
      yield* writeExportCursor(config.entryRoot, request.target, request.scope, events);
      return {
        target: request.target,
        out: file,
        files: [file],
        humanSummaryZh: "已导出等价本地搜索索引。"
      };
    }

    return yield* Effect.fail(new EntryWorkflowError("UNSUPPORTED_EXPORT_TARGET", "不支持的导出目标。", { target: request.target }));
  });
}

export function searchActivity(input: {
  entryRoot?: string;
  project?: string;
  query: string;
  limit?: number;
}): Effect.Effect<
  Array<{ event_id: string; project?: string; ts: string; summary: string; raw_ref?: string; score: number }>,
  EntryWorkflowError,
  FileSystem
> {
  return Effect.gen(function* () {
    const events = yield* queryActivity({
      entryRoot: input.entryRoot,
      project: input.project,
      limit: 1000
    });
    const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = events
      .map((event) => {
        const haystack = `${event.event} ${event.summary} ${event.project ?? ""} ${event.lane ?? ""}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { event, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.event.ts.localeCompare(a.event.ts))
      .slice(0, input.limit ?? 10);

    return matches.map(({ event, score }) => ({
      event_id: event.id,
      project: event.project,
      ts: event.ts,
      summary: event.summary,
      raw_ref: event.raw_ref,
      score
    }));
  });
}

function defaultExportOut(entryRoot: string, scope: string, target: ActivityExportTarget): string {
  const safeScope = scope.replace(/[^a-zA-Z0-9._:-]/g, "_").replace(/:/g, "-");
  if (target === "graphify-corpus") return path.join(entryRoot, "activity", "derived", "graphify", safeScope, "corpus");
  if (target === "hyperextract-input") return path.join(entryRoot, "activity", "derived", "hyperextract", safeScope, "input.md");
  if (target === "hyperextract-ka") return path.join(entryRoot, "activity", "derived", "hyperextract", safeScope, "knowledge-abstract.json");
  return path.join(entryRoot, "activity", "derived", "fts", `${safeScope}.json`);
}

function renderEventsMarkdown(title: string, events: ActivityEvent[]): string {
  return [
    `# ${title}`,
    "",
    "## Activity Events",
    ...events.map((event) => `- ${event.ts} ${event.event} ${event.project ?? ""}: ${event.summary} [${event.raw_ref ?? event.id}]`)
  ].join("\n") + "\n";
}

function renderHyperExtractInput(title: string, events: ActivityEvent[]): string {
  return [
    "---",
    "template: entry/project_timeline",
    "language: zh",
    "---",
    "",
    renderEventsMarkdown(title, events)
  ].join("\n");
}

function writeExportCursor(
  entryRoot: string,
  target: ActivityExportTarget,
  scope: string,
  events: ActivityEvent[]
): Effect.Effect<void, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const safe = `${target}-${scope}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const file = path.join(entryRoot, "activity", "derived", "cursors", `${safe}.json`);
    const latest = events.at(-1);
    yield* fs.writeFile(
      file,
      `${JSON.stringify(
        {
          target,
          scope,
          event_count: events.length,
          latest_event_id: latest?.id,
          latest_ts: latest?.ts
        },
        null,
        2
      )}\n`
    );
  });
}

function renderKnowledgeAbstract(title: string, events: ActivityEvent[]) {
  const projectEvents = events.filter((event) => event.project);
  const first = projectEvents[0] ?? events[0];
  const latest = events.at(-1);
  return {
    template: "entry/project_timeline",
    language: "zh",
    project: first?.project ?? title,
    goal: first?.summary ?? "",
    milestones: events.map((event) => ({
      ts: event.ts,
      event: event.event,
      summary: event.summary,
      evidence_ref: event.raw_ref ?? event.id
    })),
    decisions: events
      .filter((event) => event.event === "decision.recorded")
      .map((event) => ({
        ts: event.ts,
        summary: event.summary,
        evidence_ref: event.raw_ref ?? event.id
      })),
    blockers: [],
    next_actions: latest ? [`继续推进 ${latest.project ?? title}，参考 ${latest.raw_ref ?? latest.id}`] : [],
    evidence_refs: events.map((event) => event.raw_ref ?? event.id)
  };
}
