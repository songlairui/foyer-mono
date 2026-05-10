import path from "node:path";
import { Effect } from "effect";
import { EntryWorkflowError } from "../domain/errors";
import {
  RepoPrepareRequestSchema,
  RepoPrepareResultSchema,
  type RepoPrepareResult,
} from "../domain/contracts";
import { resolveConfig, projectPath } from "../domain/paths";
import { FileSystem, Shell } from "../services/context";
import { listProjects } from "./project-init";

export type RepoDevice = { device: string; repo: string; path: string };
export type RepoDeviceMulti = RepoDevice & { scanRoot: string };

export interface RepoDevicesResult {
  devices: RepoDevice[];
  humanOutputZh: string;
  humanSummaryZh: string;
}

export interface RepoDevicesMultiResult {
  devices: RepoDeviceMulti[];
  humanOutputZh: string;
  humanSummaryZh: string;
}

function renderDevices(devices: RepoDevice[]): string {
  if (devices.length === 0) return "（无仓库）\n";
  return devices.map((d) => `  ${d.repo.padEnd(32)} ${d.path}`).join("\n") + "\n";
}

function renderDevicesMulti(devices: RepoDeviceMulti[]): string {
  if (devices.length === 0) return "（无仓库）\n";
  const byRoot = new Map<string, RepoDeviceMulti[]>();
  for (const d of devices) {
    const list = byRoot.get(d.scanRoot) ?? [];
    list.push(d);
    byRoot.set(d.scanRoot, list);
  }
  const lines: string[] = [];
  for (const [root, repos] of [...byRoot].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`${root}`);
    for (const r of repos) {
      lines.push(`  ${r.repo.padEnd(32)} ${r.path}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function repoDevices(input: {
  projectsRoot?: string;
  deviceName?: string;
}): Effect.Effect<RepoDevicesResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const config = resolveConfig({
      projectsRoot: input.projectsRoot,
      deviceName: input.deviceName,
    });
    const fs = yield* FileSystem;
    if (!(yield* fs.exists(config.projectsRoot))) {
      return { devices: [], humanOutputZh: "（无仓库）\n", humanSummaryZh: "未找到仓库。" };
    }
    const files = yield* fs.listFiles(config.projectsRoot);
    const roots = new Set<string>();
    for (const file of files) {
      const parts = file.split(path.sep);
      const gitIndex = parts.lastIndexOf(".git");
      if (gitIndex > 0) roots.add(parts.slice(0, gitIndex).join(path.sep));
    }
    const devices = [...roots].sort().map((repoPath) => ({
      device: config.deviceName,
      repo: path.basename(repoPath),
      path: repoPath,
    }));
    return {
      devices,
      humanOutputZh: renderDevices(devices),
      humanSummaryZh: `共 ${devices.length} 个仓库。`,
    };
  });
}

export function repoDevicesMulti(input: {
  roots: string[];
  deviceName?: string;
}): Effect.Effect<RepoDevicesMultiResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const allResults = yield* Effect.forEach(
      input.roots,
      (root) =>
        repoDevices({ projectsRoot: root, deviceName: input.deviceName }).pipe(
          Effect.map((result) => result.devices.map((r) => ({ ...r, scanRoot: root }))),
        ),
      { concurrency: "unbounded" },
    );
    const seen = new Set<string>();
    const merged: RepoDeviceMulti[] = [];
    for (const repos of allResults) {
      for (const repo of repos) {
        if (!seen.has(repo.path)) {
          seen.add(repo.path);
          merged.push(repo);
        }
      }
    }
    const devices = merged.sort((a, b) => a.path.localeCompare(b.path));
    return {
      devices,
      humanOutputZh: renderDevicesMulti(devices),
      humanSummaryZh: `${input.roots.length} 个扫描根，共 ${devices.length} 个仓库。`,
    };
  });
}

export type RepoStatusItem = {
  repo: string;
  path: string;
  dirty: boolean;
  status: string;
};

export interface RepoStatusResult {
  statuses: RepoStatusItem[];
  humanOutputZh: string;
  humanSummaryZh: string;
}

export function repoStatus(input: {
  projectsRoot?: string;
  roots?: string[];
  all?: boolean;
  deviceName?: string;
}): Effect.Effect<RepoStatusResult, EntryWorkflowError, FileSystem | Shell> {
  return Effect.gen(function* () {
    const devicesResult = input.roots
      ? yield* repoDevicesMulti({ roots: input.roots, deviceName: input.deviceName })
      : yield* repoDevices(input);
    const repos = devicesResult.devices;
    const shell = yield* Shell;
    const statuses: RepoStatusItem[] = [];
    for (const repo of repos) {
      const result = yield* shell.run("git", ["status", "--short", "--branch"], {
        cwd: repo.path,
        allowFailure: true,
      });
      statuses.push({
        repo: repo.repo,
        path: repo.path,
        dirty: result.stdout.split(/\r?\n/).some((line) => line && !line.startsWith("##")),
        status: result.stdout.trim(),
      });
    }
    const dirtyCount = statuses.filter((s) => s.dirty).length;
    const lines = statuses.map((s) => `  ${s.dirty ? "●" : "○"} ${s.repo.padEnd(32)} ${s.path}`);
    return {
      statuses,
      humanOutputZh: lines.length > 0 ? lines.join("\n") + "\n" : "（无仓库）\n",
      humanSummaryZh: `共 ${statuses.length} 个仓库，${dirtyCount} 个有变更。`,
    };
  });
}

export function repoManifests(input: { entryRoot?: string }) {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot });
    const fs = yield* FileSystem;
    const manifestsRoot = path.join(config.entryRoot, "activity", "manifests");
    if (!(yield* fs.exists(manifestsRoot))) return [];
    const files = (yield* fs.listFiles(manifestsRoot))
      .filter((file) => file.endsWith(".json"))
      .sort();
    const manifests = [];
    for (const file of files) {
      try {
        manifests.push(JSON.parse(yield* fs.readFile(file)));
      } catch {
        continue;
      }
    }
    return manifests;
  });
}

export function repoPrepare(
  input: unknown,
): Effect.Effect<RepoPrepareResult, EntryWorkflowError, FileSystem | Shell> {
  return Effect.gen(function* () {
    const parsed = RepoPrepareRequestSchema.safeParse(input);
    if (!parsed.success) {
      return yield* Effect.fail(
        new EntryWorkflowError("INVALID_INPUT", "输入参数不合法。", {
          issues: parsed.error.issues,
        }),
      );
    }

    const request = parsed.data;
    const config = resolveConfig({
      projectsRoot: request.projectsRoot,
      foyerRoot: request.foyerRoot,
      entryRoot: request.entryRoot,
    });

    const list = yield* listProjects({
      entryRoot: config.entryRoot,
      limit: 1000,
    });

    const project = list.projects.find((p) => p.slug === request.slug);
    if (!project) {
      return yield* Effect.fail(
        new EntryWorkflowError("ENTRY_TARGET_MISSING", `未找到项目 ${request.slug}。`, {
          slug: request.slug,
        }),
      );
    }

    const targetPath = projectPath(config, request.slug);
    const devicesResult = yield* repoDevices({ projectsRoot: config.projectsRoot });
    const alreadyCloned = devicesResult.devices.some((d) => d.repo === request.slug);

    if (alreadyCloned) {
      const result: RepoPrepareResult = {
        kind: "repo-prepare-result",
        slug: request.slug,
        projectPath: targetPath,
        action: "already-ready",
        humanSummaryZh: `${request.slug} 已就绪于 ${targetPath} 。`,
      };
      return RepoPrepareResultSchema.parse(result);
    }

    if (!project.repositoryUrl) {
      return yield* Effect.fail(
        new EntryWorkflowError(
          "NETWORK_FAILURE",
          `项目 ${request.slug} 没有 repositoryUrl，无法 clone。`,
          { slug: request.slug },
        ),
      );
    }

    if (request.dryRun) {
      const result: RepoPrepareResult = {
        kind: "repo-prepare-result",
        slug: request.slug,
        projectPath: targetPath,
        repositoryUrl: project.repositoryUrl,
        action: "would-clone",
        humanSummaryZh: `将 clone ${request.slug} 从 ${project.repositoryUrl} 到 ${targetPath} 。`,
      };
      return RepoPrepareResultSchema.parse(result);
    }

    const shell = yield* Shell;
    if (!(yield* shell.commandExists("git"))) {
      return yield* Effect.fail(new EntryWorkflowError("GIT_UNAVAILABLE", "未找到 git 命令。"));
    }

    yield* shell.run("git", ["clone", project.repositoryUrl, targetPath]);

    const result: RepoPrepareResult = {
      kind: "repo-prepare-result",
      slug: request.slug,
      projectPath: targetPath,
      repositoryUrl: project.repositoryUrl,
      action: "cloned",
      humanSummaryZh: `已 clone ${request.slug} 到 ${targetPath} 。`,
    };
    return RepoPrepareResultSchema.parse(result);
  });
}
