import path from "node:path";
import { Effect } from "effect";
import { ActivityEventSchema, type ActivityEvent } from "../domain/contracts";
import type { EntryWorkflowError } from "../domain/errors";
import { resolveConfig } from "../domain/paths";
import { FileSystem, Shell } from "../services/context";
import { repoDevices, repoStatus } from "./repo";

export interface DoctorReport {
  kind: "entry-doctor-report";
  readonly: true;
  roots: {
    entryRoot: string;
    entryRootExists: boolean;
    projectsRoot: string;
    projectsRootExists: boolean;
  };
  facts: {
    eventFiles: number;
    activityEvents: number;
    malformedEventLines: number;
    eventTypes: Record<string, number>;
    projects: string[];
    recentEvents: Array<Pick<ActivityEvent, "id" | "ts" | "event" | "project" | "summary" | "raw_ref">>;
  };
  sidecars: {
    nodes: number;
    frontiers: number;
    manifests: number;
  };
  views: {
    projectPages: number;
    hasProjectIndex: boolean;
    inboxFiles: number;
  };
  derived: {
    files: number;
    cursors: number;
  };
  repositories: {
    localRepos: number;
    dirtyRepos: number;
    statuses: Array<{ repo: string; path: string; dirty: boolean; status: string }>;
  };
  warnings: string[];
  humanSummaryZh: string;
}

export function runDoctor(input: {
  entryRoot?: string;
  projectsRoot?: string;
  project?: string;
  limit?: number;
}): Effect.Effect<DoctorReport, EntryWorkflowError, FileSystem | Shell> {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot, projectsRoot: input.projectsRoot });
    const fs = yield* FileSystem;
    const shell = yield* Shell;
    const warnings: string[] = [];
    const entryRootExists = yield* fs.exists(config.entryRoot);
    const projectsRootExists = yield* fs.exists(config.projectsRoot);

    if (!entryRootExists) warnings.push(`entry 根目录不存在：${config.entryRoot}`);
    if (!projectsRootExists) warnings.push(`projects 根目录不存在：${config.projectsRoot}`);

    const eventsRoot = path.join(config.entryRoot, "activity", "events");
    const eventFiles = (yield* listFilesIfExists(eventsRoot)).filter((file) => file.endsWith(".jsonl")).sort();
    const events: ActivityEvent[] = [];
    let malformedEventLines = 0;

    for (const file of eventFiles) {
      const content = yield* fs.readFile(file);
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const parsed = ActivityEventSchema.safeParse(JSON.parse(line));
          if (!parsed.success) {
            malformedEventLines += 1;
            continue;
          }
          if (!input.project || parsed.data.project === input.project) {
            events.push(parsed.data);
          }
        } catch {
          malformedEventLines += 1;
        }
      }
    }

    const projectPages = (yield* listFilesIfExists(path.join(config.entryRoot, "projects"))).filter(
      (file) => file.endsWith(".md") && path.basename(file) !== "index.md"
    );
    const inboxFiles = (yield* listFilesIfExists(path.join(config.entryRoot, "inbox"))).filter((file) => file.endsWith(".md"));
    const nodes = (yield* listFilesIfExists(path.join(config.entryRoot, "activity", "nodes"))).filter((file) => file.endsWith(".json"));
    const frontiers = (yield* listFilesIfExists(path.join(config.entryRoot, "activity", "frontier"))).filter((file) => file.endsWith(".json"));
    const manifests = (yield* listFilesIfExists(path.join(config.entryRoot, "activity", "manifests"))).filter((file) => file.endsWith(".json"));
    const derivedFiles = yield* listFilesIfExists(path.join(config.entryRoot, "activity", "derived"));
    const cursors = derivedFiles.filter((file) => file.includes(`${path.sep}cursors${path.sep}`) && file.endsWith(".json"));
    const projectIndex = path.join(config.entryRoot, "projects", "index.md");

    const repos = projectsRootExists ? yield* repoDevices({ projectsRoot: config.projectsRoot, deviceName: config.deviceName }) : [];
    let statuses: Array<{ repo: string; path: string; dirty: boolean; status: string }> = [];
    if (projectsRootExists && (yield* shell.commandExists("git"))) {
      statuses = yield* repoStatus({ projectsRoot: config.projectsRoot, all: true, deviceName: config.deviceName });
    } else if (projectsRootExists) {
      warnings.push("未找到 git，doctor 只列出仓库路径，不检查 dirty 状态。");
    }

    const eventTypes = countBy(events, (event) => event.event);
    const projects = [...new Set(events.map((event) => event.project).filter((project): project is string => Boolean(project)))].sort();
    const recentEvents = events
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, input.limit ?? 10)
      .map((event) => ({
        id: event.id,
        ts: event.ts,
        event: event.event,
        project: event.project,
        summary: event.summary,
        raw_ref: event.raw_ref
      }));

    if (malformedEventLines > 0) warnings.push(`发现 ${malformedEventLines} 行 activity event 无法解析。`);
    if (events.length > 0 && nodes.length === 0) warnings.push("存在 activity event，但没有 activity/nodes sidecar。");
    if (events.length > 0 && manifests.length === 0) warnings.push("存在 activity event，但没有 manifest sidecar。");
    if (events.length > 0 && frontiers.length === 0) warnings.push("存在 activity event，但没有 frontier sidecar。");

    return {
      kind: "entry-doctor-report",
      readonly: true,
      roots: {
        entryRoot: config.entryRoot,
        entryRootExists,
        projectsRoot: config.projectsRoot,
        projectsRootExists
      },
      facts: {
        eventFiles: eventFiles.length,
        activityEvents: events.length,
        malformedEventLines,
        eventTypes,
        projects,
        recentEvents
      },
      sidecars: {
        nodes: nodes.length,
        frontiers: frontiers.length,
        manifests: manifests.length
      },
      views: {
        projectPages: projectPages.length,
        hasProjectIndex: yield* fs.exists(projectIndex),
        inboxFiles: inboxFiles.length
      },
      derived: {
        files: derivedFiles.length,
        cursors: cursors.length
      },
      repositories: {
        localRepos: repos.length,
        dirtyRepos: statuses.filter((status) => status.dirty).length,
        statuses
      },
      warnings,
      humanSummaryZh: `doctor 完成：${events.length} 条 activity event，${projectPages.length} 个项目页，${repos.length} 个本地仓库，${warnings.length} 个提示。`
    };
  });
}

function listFilesIfExists(root: string): Effect.Effect<string[], EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    if (!(yield* fs.exists(root))) return [];
    return yield* fs.listFiles(root);
  });
}

function countBy<A>(values: A[], keyOf: (value: A) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
