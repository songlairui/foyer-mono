import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { EntryWorkflowError, errorToJson } from "../src/domain/errors";
import { Clock, FileSystem, NodeFileSystemLive, Shell } from "../src/services/context";
import { fakeShell, fixedClock } from "../src/services/test-context";
import { runDoctor } from "../src/workflows/doctor";
import { executeProjectInit, listProjects, planProjectInit } from "../src/workflows/project-init";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("project init workflow", () => {
  it("prints a complete dry-run plan", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(entryRoot, { recursive: true });
    const plan = await Effect.runPromise(
      planProjectInit({
        slug: "demo-project",
        description: "用于验证 dry-run 的项目",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
        dryRun: true,
      }).pipe(Effect.provide(fixedClock(new Date("2026-05-05T12:00:00.000Z")))),
    );

    expect(plan.kind).toBe("project-init-plan");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "validate-input",
      "check-project-path",
      "prepare-foyer-root",
      "create-local-files",
      "git-init",
      "github-create",
      "append-activity-event",
      "update-markdown-views",
    ]);
    expect(plan.projectPath).toContain("demo-project");
  });

  it("creates a local project, first commit command sequence, activity event, and views", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(path.join(entryRoot, "projects"), { recursive: true });
    const commands: string[] = [];
    const result = await runWithServices(
      executeProjectInit({
        slug: "happy-path",
        description: "中文 happy path 项目",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
        dryRun: false,
      }),
      { onRun: (command, args) => commands.push([command, ...args].join(" ")) },
    );

    expect(result.kind).toBe("project-init-result");
    expect(commands).toEqual([
      "git init",
      "git add README.md docs/kickoff/.gitkeep",
      "git commit -m init project",
    ]);
    expect(result.entryEventPath).toContain(path.join("entry", "activity", "events"));
    await expect(
      readFile(path.join(root, "projects", "happy-path", "README.md"), "utf8"),
    ).resolves.toContain("中文 happy path 项目");
    await expect(readFile(result.entryEventPath, "utf8")).resolves.toContain(
      '"event":"project.created"',
    );
    await expect(readFile(result.views.projectPage, "utf8")).resolves.toContain("# happy-path");
    await expect(readFile(result.views.projectIndex, "utf8")).resolves.toContain("[happy-path]");
  });

  it("reports entry data through read-only doctor", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(path.join(entryRoot, "projects"), { recursive: true });
    await runWithServices(
      executeProjectInit({
        slug: "doctor-path",
        description: "doctor dashboard 项目",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
      }),
    );

    const report = await runWithServices(
      runDoctor({
        projectsRoot: path.join(root, "projects"),
        entryRoot,
        project: "doctor-path",
      }),
    );

    expect(report.readonly).toBe(true);
    expect(report.facts.activityEvents).toBe(1);
    expect(report.sidecars.nodes).toBe(1);
    expect(report.sidecars.frontiers).toBe(1);
    expect(report.sidecars.manifests).toBe(1);
    expect(report.views.projectPages).toBe(1);
    expect(report.facts.recentEvents[0]?.project).toBe("doctor-path");
  });

  it("lists projects started through activity events", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await runWithServices(
      executeProjectInit({
        slug: "alpha-project",
        description: "第一个落户项目",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
      }),
    );
    await runWithServices(
      executeProjectInit({
        slug: "beta-project",
        description: "第二个落户项目",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
      }),
    );

    const result = await runWithServices(listProjects({ entryRoot }));

    expect(result.kind).toBe("project-list-result");
    expect(result.projects.map((project) => project.slug)).toEqual([
      "alpha-project",
      "beta-project",
    ]);
    expect(result.projects[0]?.description).toBe("第一个落户项目");
    expect(result.humanOutputZh).toContain("已启动项目（2）");
  });

  it("lists legacy project.created facts without using markdown indexes as source", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const eventsDir = path.join(entryRoot, "activity", "events", "legacy-device", "2026", "05");
    await mkdir(eventsDir, { recursive: true });
    await writeFile(
      path.join(eventsDir, "01.jsonl"),
      `${JSON.stringify({
        id: "20260501T000000+0800-legacy-0001",
        device: "legacy-device",
        seq: 1,
        ts: "2026-05-01T00:00:00+08:00",
        source: "codex",
        actor: "assistant",
        event: "project.created",
        lane: "legacy_lane",
        summary: "用户发起 legacy-project：旧格式 project.created 事实。",
        raw_ref: "inbox/2026/05/2026-05-01.md",
        project_ref: "projects/legacy-project.md",
        artifacts: [
          path.join(root, "projects", "legacy-project"),
          "https://github.com/example/legacy-project",
        ],
        metadata: {
          project_name: "legacy-project",
          local_path: path.join(root, "projects", "legacy-project"),
          github_url: "https://github.com/example/legacy-project",
        },
      })}\n`,
      "utf8",
    );
    await mkdir(path.join(entryRoot, "projects"), { recursive: true });
    await writeFile(
      path.join(entryRoot, "projects", "index.md"),
      "- [ignored-index-only](ignored-index-only.md) - 不应作为事实源\n",
      "utf8",
    );

    const result = await runWithServices(listProjects({ entryRoot }));

    expect(result.projects.map((project) => project.slug)).toEqual(["legacy-project"]);
    expect(result.projects[0]?.lane).toBe("legacy_lane");
    expect(result.projects[0]?.projectPath).toBe(path.join(root, "projects", "legacy-project"));
    expect(result.projects[0]?.repositoryUrl).toBe("https://github.com/example/legacy-project");
  });

  it("fails when target directory already exists", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(path.join(root, "projects", "already-here"), { recursive: true });
    await mkdir(entryRoot, { recursive: true });

    await expectFailureCode(
      executeProjectInit({
        slug: "already-here",
        description: "目录已存在",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
      }),
      "DIRECTORY_ALREADY_EXISTS",
    );
  });

  it("fails when gh is required but unavailable", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(entryRoot, { recursive: true });

    await expectFailureCode(
      executeProjectInit({
        slug: "needs-gh",
        description: "需要 GitHub",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
        createGithub: true,
      }),
      "GH_UNAVAILABLE",
      { missing: ["gh"] },
    );
  });

  it("creates the Foyer data root when it is missing", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");

    const result = await runWithServices(
      executeProjectInit({
        slug: "missing-root",
        description: "数据根不存在也应由 CLI 托管创建",
        projectsRoot: path.join(root, "projects"),
        entryRoot,
      }),
    );

    await expect(readFile(result.views.projectIndex, "utf8")).resolves.toContain("[missing-root]");
  });
});

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "entry-init-project-"));
  tempDirs.push(dir);
  return dir;
}

function runWithServices<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell | Clock>,
  shellOptions: Parameters<typeof fakeShell>[0] = {},
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          NodeFileSystemLive,
          fakeShell(shellOptions),
          fixedClock(new Date("2026-05-05T12:00:00.000Z")),
        ),
      ),
    ),
  );
}

async function expectFailureCode<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell | Clock>,
  code: string,
  shellOptions: Parameters<typeof fakeShell>[0] = {},
): Promise<void> {
  const exit = await Effect.runPromiseExit(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          NodeFileSystemLive,
          fakeShell(shellOptions),
          fixedClock(new Date("2026-05-05T12:00:00.000Z")),
        ),
      ),
    ),
  );
  expect(exit._tag).toBe("Failure");
  expect((errorToJson(exit).error as { code: string }).code).toBe(code);
}
