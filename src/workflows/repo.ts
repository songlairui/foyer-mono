import path from "node:path";
import { Effect } from "effect";
import { EntryWorkflowError } from "../domain/errors";
import { resolveConfig } from "../domain/paths";
import { FileSystem, Shell } from "../services/context";

export function repoDevices(input: { projectsRoot?: string; deviceName?: string }) {
  return Effect.gen(function* () {
    const config = resolveConfig({ projectsRoot: input.projectsRoot, deviceName: input.deviceName });
    const fs = yield* FileSystem;
    if (!(yield* fs.exists(config.projectsRoot))) return [];
    const files = yield* fs.listFiles(config.projectsRoot);
    const roots = new Set<string>();
    for (const file of files) {
      const parts = file.split(path.sep);
      const gitIndex = parts.lastIndexOf(".git");
      if (gitIndex > 0) roots.add(parts.slice(0, gitIndex).join(path.sep));
    }
    return [...roots].sort().map((repoPath) => ({
      device: config.deviceName,
      repo: path.basename(repoPath),
      path: repoPath
    }));
  });
}

export function repoStatus(input: { projectsRoot?: string; all?: boolean; deviceName?: string }): Effect.Effect<
  Array<{ repo: string; path: string; dirty: boolean; status: string }>,
  EntryWorkflowError,
  FileSystem | Shell
> {
  return Effect.gen(function* () {
    const repos = yield* repoDevices(input);
    const shell = yield* Shell;
    const statuses = [];
    for (const repo of repos) {
      const result = yield* shell.run("git", ["status", "--short", "--branch"], { cwd: repo.path, allowFailure: true });
      statuses.push({
        repo: repo.repo,
        path: repo.path,
        dirty: result.stdout.split(/\r?\n/).some((line) => line && !line.startsWith("##")),
        status: result.stdout.trim()
      });
    }
    return statuses;
  });
}

export function repoManifests(input: { entryRoot?: string }) {
  return Effect.gen(function* () {
    const config = resolveConfig({ entryRoot: input.entryRoot });
    const fs = yield* FileSystem;
    const manifestsRoot = path.join(config.entryRoot, "activity", "manifests");
    if (!(yield* fs.exists(manifestsRoot))) return [];
    const files = (yield* fs.listFiles(manifestsRoot)).filter((file) => file.endsWith(".json")).sort();
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
