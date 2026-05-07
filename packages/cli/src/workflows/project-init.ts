import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import {
  ProjectListRequestSchema,
  ProjectListResultSchema,
  ProjectInitPlanSchema,
  ProjectInitRequestSchema,
  ProjectInitResultSchema,
  type ActivityEvent,
  type PlanStep,
  type ProjectListItem,
  type ProjectListResult,
  type ProjectInitPlan,
  type ProjectInitRequest,
  type ProjectInitResult,
} from "../domain/contracts";
import { EntryWorkflowError, invalidInput } from "../domain/errors";
import { entryPaths, projectPath, resolveConfig } from "../domain/paths";
import {
  eventRawRef,
  makeActivityEvent,
  renderInboxEntry,
  renderIndexLine,
  renderProjectPage,
  renderProjectReadme,
} from "../domain/render";
import { Clock, FileSystem, Shell } from "../services/context";
import { queryActivity } from "./activity";
import { writeActivityFact } from "./activity-store";

export function planProjectInit(
  input: unknown,
): Effect.Effect<ProjectInitPlan, EntryWorkflowError, Clock | FileSystem | Shell> {
  return Effect.gen(function* () {
    const parsed = ProjectInitRequestSchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));

    let request = parsed.data;
    const config = resolveConfig(request);

    if (request.initFrom === undefined) {
      const events = yield* Effect.catchAll(
        queryActivity({ entryRoot: config.entryRoot, limit: 1000 }),
        () => Effect.succeed([] as ActivityEvent[]),
      );
      const detected = yield* autoDetectInitFrom(events);
      if (detected) request = { ...request, initFrom: detected };
    }

    const clock = yield* Clock;
    const now = yield* clock.now();
    const targetProjectPath = projectPath(config, request.slug);
    const paths = entryPaths(config, request.slug, now);
    const steps = planSteps(request, targetProjectPath, paths.eventFile);
    const initFromNote = request.initFrom ? `init-from: ${request.initFrom}` : undefined;
    const plan: ProjectInitPlan = {
      kind: "project-init-plan",
      request: { ...request, dryRun: true },
      config,
      projectPath: targetProjectPath,
      entryPaths: paths,
      steps,
      warnings: [
        ...(request.createGithub
          ? []
          : ["未启用 GitHub 创建；执行时只创建本地仓库和 Foyer 记录。"]),
        ...(initFromNote ? [initFromNote] : []),
      ],
      humanSummaryZh: `将初始化项目 ${request.slug}，目标目录为 ${targetProjectPath} 。dry-run 不会产生副作用。`,
    };

    return ProjectInitPlanSchema.parse(plan);
  });
}

export function executeProjectInit(
  input: unknown,
): Effect.Effect<ProjectInitResult, EntryWorkflowError, FileSystem | Shell | Clock> {
  return Effect.gen(function* () {
    const parsed = ProjectInitRequestSchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));

    let requestData = { ...parsed.data, dryRun: false };
    const config = resolveConfig(requestData);

    if (requestData.initFrom === undefined) {
      const events = yield* Effect.catchAll(
        queryActivity({ entryRoot: config.entryRoot, limit: 1000 }),
        () => Effect.succeed([] as ActivityEvent[]),
      );
      const detected = yield* autoDetectInitFrom(events);
      if (detected) requestData = { ...requestData, initFrom: detected };
    }

    const request: ProjectInitRequest = requestData;
    const fs = yield* FileSystem;
    const shell = yield* Shell;
    const clock = yield* Clock;
    const now = yield* clock.now();
    const targetProjectPath = projectPath(config, request.slug);
    const paths = entryPaths(config, request.slug, now);

    if (yield* fs.exists(targetProjectPath)) {
      return yield* Effect.fail(
        new EntryWorkflowError("DIRECTORY_ALREADY_EXISTS", "目标项目目录已存在。", {
          projectPath: targetProjectPath,
        }),
      );
    }

    if (!(yield* shell.commandExists("git"))) {
      return yield* Effect.fail(new EntryWorkflowError("GIT_UNAVAILABLE", "未找到 git 命令。"));
    }

    if (request.createGithub && !(yield* shell.commandExists("gh"))) {
      return yield* Effect.fail(
        new EntryWorkflowError("GH_UNAVAILABLE", "未找到 gh 命令，无法创建 GitHub 仓库。"),
      );
    }

    if (request.createGithub) {
      const auth = yield* shell.run("gh", ["auth", "status"], { allowFailure: true });
      if (auth.exitCode !== 0) {
        return yield* Effect.fail(
          new EntryWorkflowError("GH_UNAVAILABLE", "gh 未登录或不可用，无法创建 GitHub 仓库。", {
            stderr: auth.stderr,
          }),
        );
      }
    }

    yield* fs.ensureDir(config.entryRoot);
    yield* fs.ensureDir(path.join(targetProjectPath, "docs", "kickoff"));
    yield* fs.writeFile(path.join(targetProjectPath, "README.md"), renderProjectReadme(request));
    yield* fs.writeFile(path.join(targetProjectPath, "docs", "kickoff", ".gitkeep"), "");

    yield* shell.run("git", ["init"], { cwd: targetProjectPath });
    yield* shell.run("git", ["add", "README.md", "docs/kickoff/.gitkeep"], {
      cwd: targetProjectPath,
    });
    yield* shell.run("git", ["commit", "-m", "init project"], { cwd: targetProjectPath });

    let repositoryUrl: string | undefined;
    if (request.createGithub) {
      let owner = config.githubOwner;
      if (!owner) {
        const whoami = yield* shell.run("gh", ["api", "user", "--jq", ".login"], {
          allowFailure: true,
        });
        if (whoami.exitCode === 0 && whoami.stdout.trim()) {
          owner = whoami.stdout.trim();
        }
      }
      const repoName = owner ? `${owner}/${request.slug}` : request.slug;
      const visibilityFlag = `--${request.githubVisibility}`;
      yield* shell.run(
        "gh",
        [
          "repo",
          "create",
          repoName,
          visibilityFlag,
          "--source",
          ".",
          "--remote",
          "origin",
          "--push",
        ],
        {
          cwd: targetProjectPath,
        },
      );
      repositoryUrl = `https://github.com/${repoName}`;
    }

    const rawRef = eventRawRef(config, paths.eventFile);
    const event = makeActivityEvent({
      event: "project.created",
      request,
      config,
      summary: `创建项目 ${request.slug}：${request.description}`,
      rawRef,
      source: "foyer project init",
      data: {
        description: request.description,
        projectPath: targetProjectPath,
        repositoryUrl,
        initFrom: request.initFrom,
      },
      now,
    });

    yield* writeActivityFact({ config, eventFile: paths.eventFile, event });
    yield* fs.writeFile(paths.projectPage, renderProjectPage(request, targetProjectPath, event));
    yield* upsertProjectIndexLine(paths.projectIndex, renderIndexLine(request, paths.projectPage));
    yield* fs.appendFile(paths.inboxFile, renderInboxEntry(request, event));

    const steps = planSteps(request, targetProjectPath, paths.eventFile).map((step) => ({
      ...step,
      status: step.status === "skipped" ? "skipped" : "done",
    })) satisfies PlanStep[];

    const result: ProjectInitResult = {
      kind: "project-init-result",
      request,
      projectPath: targetProjectPath,
      repositoryUrl,
      entryEventPath: paths.eventFile,
      views: {
        projectPage: paths.projectPage,
        projectIndex: paths.projectIndex,
        inboxFile: paths.inboxFile,
      },
      steps,
      activityEvent: event,
      humanSummaryZh: `已创建项目 ${request.slug}，写入本地仓库、Foyer activity event 与 Markdown 视图。`,
    };

    return ProjectInitResultSchema.parse(result);
  });
}

function planSteps(
  request: ProjectInitRequest,
  targetProjectPath: string,
  eventFile: string,
): PlanStep[] {
  const githubStep: PlanStep = request.createGithub
    ? {
        id: "github-create",
        titleZh: "创建 GitHub 仓库并推送",
        detailZh: `通过 gh 创建 ${request.githubVisibility} 仓库，并把首次提交推送到 origin。`,
        effect: "network",
        status: "planned",
      }
    : {
        id: "github-create",
        titleZh: "跳过 GitHub 创建",
        detailZh: "未传入 --github，本次执行不会访问 GitHub。",
        effect: "network",
        status: "skipped",
      };

  return [
    {
      id: "validate-input",
      titleZh: "校验输入",
      detailZh: "校验项目名、描述、lane、owner 和路径安全性。",
      effect: "check",
      status: "planned",
    },
    {
      id: "check-project-path",
      titleZh: "检查目标目录",
      detailZh: `确认 ${targetProjectPath} 尚不存在，避免覆盖已有项目。`,
      effect: "check",
      status: "planned",
    },
    {
      id: "prepare-foyer-root",
      titleZh: "准备 Foyer 数据根",
      detailZh: `确认 activity event 可追加到 ${eventFile}，必要时创建 Foyer 子目录。`,
      effect: "check",
      status: "planned",
    },
    {
      id: "create-local-files",
      titleZh: "创建本地目录和 README",
      detailZh: "创建项目目录、docs/kickoff 和中文 README。",
      effect: "write",
      status: "planned",
    },
    {
      id: "git-init",
      titleZh: "初始化 Git 并生成第一提交",
      detailZh: "执行 git init、git add 和 git commit。",
      effect: "shell",
      status: "planned",
    },
    githubStep,
    {
      id: "append-activity-event",
      titleZh: "追加 Foyer activity event",
      detailZh: "向 append-only JSONL 写入 project.created 事件。",
      effect: "write",
      status: "planned",
    },
    {
      id: "update-markdown-views",
      titleZh: "更新 Markdown 视图",
      detailZh: "生成项目页、更新项目索引，并向当天 inbox 追加中文摘要。",
      effect: "derived",
      status: "planned",
    },
  ];
}

function upsertProjectIndexLine(
  indexPath: string,
  line: string,
): Effect.Effect<void, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const exists = yield* fs.exists(indexPath);
    const content = exists ? yield* fs.readFile(indexPath) : "# Projects\n\n";
    const lines = content.split(/\r?\n/).filter((value) => value.trim().length > 0);
    const slug = line.match(/^- \[([^\]]+)\]/)?.[1];
    const filtered = slug ? lines.filter((current) => !current.startsWith(`- [${slug}](`)) : lines;
    const prefix = filtered.length === 0 || !filtered[0].startsWith("#") ? ["# Projects"] : [];
    const next = [...prefix, ...filtered, line].join("\n") + "\n";
    yield* fs.writeFile(indexPath, next);
  });
}

export function listProjects(
  input: unknown,
): Effect.Effect<ProjectListResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const parsed = ProjectListRequestSchema.safeParse(input);
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));

    const request = parsed.data;
    const config = resolveConfig({ foyerRoot: request.foyerRoot, entryRoot: request.entryRoot });
    const events = yield* queryActivity({
      entryRoot: config.entryRoot,
      limit: request.limit,
    });
    const latestByProject = latestProjectEvents(events);
    const items = new Map<string, ProjectListItem>();

    for (const event of events) {
      if (
        !event.project ||
        (event.event !== "project.created" && event.event !== "project.initialized")
      )
        continue;
      if (items.has(event.project)) continue;

      const latest = latestByProject.get(event.project);
      items.set(event.project, {
        slug: event.project,
        description: projectDescription(event),
        lane: event.lane,
        owner: event.owner,
        projectPath: stringData(event, "projectPath"),
        repositoryUrl: stringData(event, "repositoryUrl"),
        initFrom: stringData(event, "initFrom"),
        createdAt: event.ts,
        createdEventId: event.id,
        latestEventAt: latest?.ts,
        latestEventId: latest?.id,
      });
    }

    const projects = [...items.values()].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.slug.localeCompare(b.slug),
    );
    const result: ProjectListResult = {
      kind: "project-list-result",
      entryRoot: config.entryRoot,
      projects,
      humanOutputZh: renderProjectList(projects),
      humanSummaryZh: `已列出 ${projects.length} 个已启动项目。`,
    };

    return ProjectListResultSchema.parse(result);
  });
}

function latestProjectEvents(events: ActivityEvent[]): Map<string, ActivityEvent> {
  const latest = new Map<string, ActivityEvent>();
  for (const event of events) {
    if (!event.project) continue;
    const current = latest.get(event.project);
    if (!current || event.ts > current.ts) latest.set(event.project, event);
  }
  return latest;
}

function projectDescription(event: ActivityEvent): string {
  const structured = stringData(event, "description");
  if (structured) return structured;
  const prefix = event.project ? `创建项目 ${event.project}：` : "";
  if (prefix && event.summary.startsWith(prefix)) return event.summary.slice(prefix.length);
  return event.summary;
}

function stringData(event: ActivityEvent, key: string): string | undefined {
  const value = event.data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeRepoUrl(url: string): string {
  return url.replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "");
}

function extractUsernameRepo(remote: string): string | undefined {
  const normalized = normalizeRepoUrl(remote);
  const match = normalized.match(/^https?:\/\/github\.com\/([^/]+\/[^/?#]+)$/);
  return match?.[1];
}

function autoDetectInitFrom(
  events: ActivityEvent[],
): Effect.Effect<string | undefined, never, Shell> {
  return Effect.gen(function* () {
    const shell = yield* Shell;

    const remoteResult = yield* Effect.catchAll(
      shell.run("git", ["remote", "get-url", "origin"], { allowFailure: true }),
      () => Effect.succeed({ exitCode: 1, stdout: "", stderr: "" }),
    );

    const remote = remoteResult.exitCode === 0 ? remoteResult.stdout.trim() : "";

    if (remote) {
      const normalizedRemote = normalizeRepoUrl(remote);
      for (const event of events) {
        if (event.event !== "project.created" && event.event !== "project.initialized") continue;
        const repoUrl = stringData(event, "repositoryUrl");
        if (repoUrl && normalizeRepoUrl(repoUrl) === normalizedRemote) {
          return event.project;
        }
      }
      const usernameRepo = extractUsernameRepo(remote);
      if (usernameRepo) return usernameRepo;
    }

    const rootResult = yield* Effect.catchAll(
      shell.run("git", ["rev-parse", "--show-toplevel"], { allowFailure: true }),
      () => Effect.succeed({ exitCode: 1, stdout: "", stderr: "" }),
    );
    if (rootResult.exitCode === 0 && rootResult.stdout.trim()) {
      const root = rootResult.stdout.trim();
      const home = os.homedir();
      return root.startsWith(`${home}/`) ? root.slice(home.length + 1) : root;
    }

    return undefined;
  });
}

function renderProjectList(projects: ProjectListItem[]): string {
  if (projects.length === 0) return "暂无已启动项目。\n";
  return (
    [
      `已启动项目（${projects.length}）`,
      ...projects.map((project) =>
        [
          `- ${project.slug} | ${project.lane ?? "-"} | ${project.owner ?? "-"} | ${project.createdAt}`,
          `  ${project.description}`,
          project.projectPath ? `  path: ${project.projectPath}` : undefined,
          project.repositoryUrl ? `  repo: ${project.repositoryUrl}` : undefined,
          project.initFrom ? `  init-from: ${project.initFrom}` : undefined,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n"),
      ),
    ].join("\n") + "\n"
  );
}

export function upsertProjectIndex(input: {
  slug: string;
  description: string;
  lane?: string;
  owner?: ProjectInitRequest["owner"];
  entryRoot?: string;
  deviceName?: string;
}): Effect.Effect<
  { projectIndex: string; humanSummaryZh: string },
  EntryWorkflowError,
  FileSystem
> {
  return Effect.gen(function* () {
    const parsed = ProjectInitRequestSchema.safeParse({
      slug: input.slug,
      description: input.description,
      lane: input.lane ?? "project",
      owner: input.owner ?? "me",
      entryRoot: input.entryRoot,
      deviceName: input.deviceName,
    });
    if (!parsed.success) return yield* Effect.fail(invalidInput(parsed.error));
    const config = resolveConfig(parsed.data);
    const page = path.join(config.entryRoot, "projects", `${parsed.data.slug}.md`);
    const index = path.join(config.entryRoot, "projects", "index.md");
    yield* upsertProjectIndexLine(index, renderIndexLine(parsed.data, page));
    return {
      projectIndex: index,
      humanSummaryZh: `已更新项目索引：${parsed.data.slug}`,
    };
  });
}
