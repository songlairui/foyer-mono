import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { EntryWorkflowError } from "../src/domain/errors";
import {
  DEFAULT_PROJECTS_ROOT,
  repoRootsAdd,
  repoRootsList,
  repoRootsRemove,
} from "../src/domain/scan-roots";
import { FileSystem, NodeFileSystemLive, Shell } from "../src/services/context";
import { fakeShell } from "../src/services/test-context";
import { repoDevicesMulti } from "../src/workflows/repo";

const tempDirs: string[] = [];
let scanRootsFile: string;

beforeEach(async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "foyer-scan-roots-"));
  tempDirs.push(tmp);
  scanRootsFile = path.join(tmp, "scan-roots.json");
  process.env.FOYER_SCAN_ROOTS_FILE = scanRootsFile;
});

afterEach(async () => {
  delete process.env.FOYER_SCAN_ROOTS_FILE;
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "foyer-multi-"));
  tempDirs.push(dir);
  return dir;
}

function runFs<A>(effect: Effect.Effect<A, EntryWorkflowError, FileSystem>): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(NodeFileSystemLive)));
}

function runFsShell<A>(
  effect: Effect.Effect<A, EntryWorkflowError, FileSystem | Shell>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(Layer.mergeAll(NodeFileSystemLive, fakeShell()))),
  );
}

describe("repoRootsList", () => {
  it("returns default when scan-roots.json does not exist", async () => {
    const result = await runFs(repoRootsList());
    expect(result.roots).toEqual([DEFAULT_PROJECTS_ROOT]);
    expect(result.humanSummaryZh).toContain("1 个");
  });

  it("reads roots from file when it exists", async () => {
    const extra = path.join(os.homedir(), "repos");
    await writeFile(scanRootsFile, JSON.stringify({ roots: ["~/repos"] }, null, 2), "utf8");
    const result = await runFs(repoRootsList());
    expect(result.roots).toEqual([extra]);
  });
});

describe("repoRootsAdd", () => {
  it("adds a new root to an empty list", async () => {
    const tmp = await tempRoot();
    const result = await runFs(repoRootsAdd(tmp));
    expect(result.changed).toBe(true);
    expect(result.roots).toContain(tmp);
    expect(result.roots).toContain(DEFAULT_PROJECTS_ROOT);
  });

  it("is idempotent: second add returns changed: false", async () => {
    const tmp = await tempRoot();
    const first = await runFs(repoRootsAdd(tmp));
    expect(first.changed).toBe(true);

    const second = await runFs(repoRootsAdd(tmp));
    expect(second.changed).toBe(false);
    expect(second.roots.filter((r) => r === tmp)).toHaveLength(1);
  });

  it("persists roots to file so next call reads them", async () => {
    const tmp = await tempRoot();
    await runFs(repoRootsAdd(tmp));

    const listed = await runFs(repoRootsList());
    expect(listed.roots).toContain(tmp);
  });
});

describe("repoRootsRemove", () => {
  it("removes an existing root", async () => {
    const tmp = await tempRoot();
    await runFs(repoRootsAdd(tmp));

    const result = await runFs(repoRootsRemove(tmp));
    expect(result.changed).toBe(true);
    expect(result.roots).not.toContain(tmp);
  });

  it("reports changed: false for a root not in list", async () => {
    const tmp = await tempRoot();
    const result = await runFs(repoRootsRemove(tmp));
    expect(result.changed).toBe(false);
  });

  it("refuses to remove the last root", async () => {
    const listed = await runFs(repoRootsList());
    expect(listed.roots).toHaveLength(1);

    const result = await runFs(repoRootsRemove(listed.roots[0]));
    expect(result.changed).toBe(false);
  });
});

describe("repoDevicesMulti", () => {
  it("aggregates repos from multiple roots", async () => {
    const tmp = await tempRoot();
    const rootA = path.join(tmp, "rootA");
    const rootB = path.join(tmp, "rootB");

    await mkdir(path.join(rootA, "repo-alpha", ".git"), { recursive: true });
    await writeFile(path.join(rootA, "repo-alpha", ".git", "HEAD"), "ref: refs/heads/main\n");

    await mkdir(path.join(rootB, "repo-beta", ".git"), { recursive: true });
    await writeFile(path.join(rootB, "repo-beta", ".git", "HEAD"), "ref: refs/heads/main\n");

    const result = await runFsShell(repoDevicesMulti({ roots: [rootA, rootB] }));
    const devices = result.devices;

    expect(devices).toHaveLength(2);
    const names = devices.map((r) => r.repo);
    expect(names).toContain("repo-alpha");
    expect(names).toContain("repo-beta");

    const alpha = devices.find((r) => r.repo === "repo-alpha")!;
    expect(alpha.scanRoot).toBe(rootA);
    const beta = devices.find((r) => r.repo === "repo-beta")!;
    expect(beta.scanRoot).toBe(rootB);
  });

  it("deduplicates repos appearing via the same path across roots", async () => {
    const tmp = await tempRoot();
    const sharedRoot = path.join(tmp, "shared");
    await mkdir(path.join(sharedRoot, "shared-repo", ".git"), { recursive: true });
    await writeFile(path.join(sharedRoot, "shared-repo", ".git", "HEAD"), "ref: refs/heads/main\n");

    const result = await runFsShell(repoDevicesMulti({ roots: [sharedRoot, sharedRoot] }));
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].repo).toBe("shared-repo");
  });

  it("returns empty array when all roots are missing", async () => {
    const tmp = await tempRoot();
    const result = await runFsShell(repoDevicesMulti({ roots: [path.join(tmp, "nonexistent")] }));
    expect(result.devices).toEqual([]);
  });

  it("adds scanRoot field to each result", async () => {
    const tmp = await tempRoot();
    const rootA = path.join(tmp, "rootA");
    await mkdir(path.join(rootA, "my-repo", ".git"), { recursive: true });
    await writeFile(path.join(rootA, "my-repo", ".git", "HEAD"), "ref: refs/heads/main\n");

    const result = await runFsShell(repoDevicesMulti({ roots: [rootA] }));
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].scanRoot).toBe(rootA);
    expect(result.devices[0].repo).toBe("my-repo");
    expect(typeof result.devices[0].device).toBe("string");
  });
});
