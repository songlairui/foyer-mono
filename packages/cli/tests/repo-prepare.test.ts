import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { EntryWorkflowError, errorToJson } from "../src/domain/errors";
import { Clock, FileSystem, NodeFileSystemLive, Shell } from "../src/services/context";
import { fakeShell, fixedClock } from "../src/services/test-context";
import { repoPrepare } from "../src/workflows/repo";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("repo prepare workflow", () => {
  it("reports already-ready when repo is cloned locally", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");
    await mkdir(path.join(entryRoot, "activity", "events", "test-device", "2026", "05"), {
      recursive: true,
    });
    // Simulate a locally-cloned repo (needs at least one file inside .git)
    const repoDir = path.join(projectsRoot, "existing-repo");
    await mkdir(path.join(repoDir, ".git"), { recursive: true });
    await writeFile(path.join(repoDir, ".git", "HEAD"), "ref: refs/heads/main\n");

    await writeFile(
      path.join(entryRoot, "activity", "events", "test-device", "2026", "05", "07.jsonl"),
      `${JSON.stringify({
        id: "evt_existing",
        ts: "2026-05-07T10:00:00+08:00",
        device: "test-device",
        event: "project.created",
        project: "existing-repo",
        summary: "创建项目 existing-repo：已存在",
        data: {
          description: "已存在的项目",
          projectPath: repoDir,
          repositoryUrl: "https://github.com/example/existing-repo",
        },
        hash: "sha256:test",
      })}\n`,
      "utf8",
    );

    const result = await runWithServices(
      repoPrepare({
        slug: "existing-repo",
        projectsRoot,
        entryRoot,
      }),
    );

    expect(result.kind).toBe("repo-prepare-result");
    expect(result.action).toBe("already-ready");
    expect(result.slug).toBe("existing-repo");
    expect(result.humanSummaryZh).toContain("已就绪");
  });

  it("clones a project that is not yet local", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");
    await mkdir(path.join(entryRoot, "activity", "events", "test-device", "2026", "05"), {
      recursive: true,
    });
    const repoUrl = "https://github.com/example/remote-only";

    // Write a project.created event with repositoryUrl in data
    await writeFile(
      path.join(entryRoot, "activity", "events", "test-device", "2026", "05", "07.jsonl"),
      `${JSON.stringify({
        id: "evt_remote_only_001",
        ts: "2026-05-07T10:00:00+08:00",
        device: "test-device",
        event: "project.created",
        project: "remote-only",
        summary: "创建项目 remote-only：仅远程存在",
        data: {
          description: "仅远程存在的项目",
          projectPath: path.join(projectsRoot, "remote-only"),
          repositoryUrl: repoUrl,
        },
        hash: "sha256:test",
      })}\n`,
      "utf8",
    );

    // prepare on a projectsRoot without the repo
    const commands: string[] = [];
    const result = await runWithServices(
      repoPrepare({
        slug: "remote-only",
        projectsRoot,
        entryRoot,
      }),
      {
        onRun: (command, args) => commands.push([command, ...args].join(" ")),
      },
    );

    expect(result.kind).toBe("repo-prepare-result");
    expect(result.action).toBe("cloned");
    expect(result.slug).toBe("remote-only");
    expect(result.repositoryUrl).toBe(repoUrl);
    expect(result.humanSummaryZh).toContain("已 clone");
    expect(commands).toContain(`git clone ${repoUrl} ${path.join(projectsRoot, "remote-only")}`);
  });

  it("dry-run shows planned clone without executing", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");
    await mkdir(path.join(entryRoot, "activity", "events", "test-device", "2026", "05"), {
      recursive: true,
    });
    const repoUrl = "https://github.com/example/would-clone";

    await writeFile(
      path.join(entryRoot, "activity", "events", "test-device", "2026", "05", "07.jsonl"),
      `${JSON.stringify({
        id: "evt_dry_run",
        ts: "2026-05-07T10:00:00+08:00",
        device: "test-device",
        event: "project.created",
        project: "would-clone",
        summary: "创建项目 would-clone：dry-run 测试",
        data: {
          description: "dry-run 测试",
          projectPath: path.join(projectsRoot, "would-clone"),
          repositoryUrl: repoUrl,
        },
        hash: "sha256:test",
      })}\n`,
      "utf8",
    );

    const commands: string[] = [];
    const result = await runWithServices(
      repoPrepare({
        slug: "would-clone",
        projectsRoot,
        entryRoot,
        dryRun: true,
      }),
      {
        onRun: (command, args) => commands.push([command, ...args].join(" ")),
      },
    );

    expect(result.kind).toBe("repo-prepare-result");
    expect(result.action).toBe("would-clone");
    expect(result.repositoryUrl).toBe(repoUrl);
    expect(result.humanSummaryZh).toContain("将 clone");
    expect(commands).toEqual([]); // no git commands executed
  });

  it("dry-run still reports already-ready for cloned repos", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    const projectsRoot = path.join(root, "projects");
    await mkdir(path.join(entryRoot, "activity", "events", "test-device", "2026", "05"), {
      recursive: true,
    });
    const repoDir = path.join(projectsRoot, "dry-ready");
    await mkdir(path.join(repoDir, ".git"), { recursive: true });
    await writeFile(path.join(repoDir, ".git", "HEAD"), "ref: refs/heads/main\n");

    await writeFile(
      path.join(entryRoot, "activity", "events", "test-device", "2026", "05", "07.jsonl"),
      `${JSON.stringify({
        id: "evt_dry_ready",
        ts: "2026-05-07T10:00:00+08:00",
        device: "test-device",
        event: "project.created",
        project: "dry-ready",
        summary: "创建项目 dry-ready：已存在",
        data: {
          description: "已存在",
          projectPath: repoDir,
          repositoryUrl: "https://github.com/example/dry-ready",
        },
        hash: "sha256:test",
      })}\n`,
      "utf8",
    );

    const result = await runWithServices(
      repoPrepare({
        slug: "dry-ready",
        projectsRoot,
        entryRoot,
        dryRun: true,
      }),
    );

    expect(result.action).toBe("already-ready");
  });

  it("fails when project slug is not found", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(path.join(entryRoot, "projects"), { recursive: true });

    await expectFailureCode(
      repoPrepare({
        slug: "nonexistent-project",
        entryRoot,
      }),
      "ENTRY_TARGET_MISSING",
    );
  });

  it("fails when project has no repositoryUrl", async () => {
    const root = await tempRoot();
    const entryRoot = path.join(root, "entry");
    await mkdir(path.join(entryRoot, "activity", "events", "test-device", "2026", "05"), {
      recursive: true,
    });
    await writeFile(
      path.join(entryRoot, "activity", "events", "test-device", "2026", "05", "07.jsonl"),
      `${JSON.stringify({
        id: "evt_test_no_url",
        ts: "2026-05-07T10:00:00+08:00",
        device: "test-device",
        event: "project.created",
        project: "no-url-project",
        summary: "创建项目 no-url-project：没有远程地址",
        hash: "sha256:test",
      })}\n`,
      "utf8",
    );

    await expectFailureCode(
      repoPrepare({
        slug: "no-url-project",
        entryRoot,
      }),
      "NETWORK_FAILURE",
    );
  });
});

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "foyer-mono-"));
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
          fixedClock(new Date("2026-05-07T12:00:00.000Z")),
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
          fixedClock(new Date("2026-05-07T12:00:00.000Z")),
        ),
      ),
    ),
  );
  expect(exit._tag).toBe("Failure");
  expect((errorToJson(exit).error as { code: string }).code).toBe(code);
}
