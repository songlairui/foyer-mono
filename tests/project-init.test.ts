import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { EntryWorkflowError, errorToJson } from "../src/domain/errors";
import { Clock, FileSystem, NodeFileSystemLive, Shell } from "../src/services/context";
import { fakeShell, fixedClock } from "../src/services/test-context";
import { executeProjectInit, planProjectInit } from "../src/workflows/project-init";

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
        dryRun: true
      }).pipe(Effect.provide(fixedClock(new Date("2026-05-05T12:00:00.000Z"))))
    );

    expect(plan.kind).toBe("project-init-plan");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "validate-input",
      "check-project-path",
      "check-entry-root",
      "create-local-files",
      "git-init",
      "github-create",
      "append-activity-event",
      "update-markdown-views"
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
        dryRun: false
      }),
      { onRun: (command, args) => commands.push([command, ...args].join(" ")) }
    );

    expect(result.kind).toBe("project-init-result");
    expect(commands).toEqual(["git init", "git add README.md docs/kickoff/.gitkeep", "git commit -m init project"]);
    await expect(readFile(path.join(root, "projects", "happy-path", "README.md"), "utf8")).resolves.toContain("中文 happy path 项目");
    await expect(readFile(result.entryEventPath, "utf8")).resolves.toContain("\"event\":\"project.created\"");
    await expect(readFile(result.views.projectPage, "utf8")).resolves.toContain("# happy-path");
    await expect(readFile(result.views.projectIndex, "utf8")).resolves.toContain("[happy-path]");
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
          entryRoot
        }),
      "DIRECTORY_ALREADY_EXISTS"
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
          createGithub: true
        }),
      "GH_UNAVAILABLE",
      { missing: ["gh"] }
    );
  });

  it("fails when entry write target is missing", async () => {
    const root = await tempRoot();

    await expectFailureCode(
        executeProjectInit({
          slug: "missing-entry",
          description: "entry 不存在",
          projectsRoot: path.join(root, "projects"),
          entryRoot: path.join(root, "entry")
        }),
      "ENTRY_TARGET_MISSING"
    );
  });
});

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "entry-init-project-"));
  tempDirs.push(dir);
  return dir;
}

function runWithServices<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell | Clock>,
  shellOptions: Parameters<typeof fakeShell>[0] = {}
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(NodeFileSystemLive, fakeShell(shellOptions), fixedClock(new Date("2026-05-05T12:00:00.000Z")))
      )
    )
  );
}

async function expectFailureCode<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell | Clock>,
  code: string,
  shellOptions: Parameters<typeof fakeShell>[0] = {}
): Promise<void> {
  const exit = await Effect.runPromiseExit(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(NodeFileSystemLive, fakeShell(shellOptions), fixedClock(new Date("2026-05-05T12:00:00.000Z")))
      )
    )
  );
  expect(exit._tag).toBe("Failure");
  expect((errorToJson(exit).error as { code: string }).code).toBe(code);
}
