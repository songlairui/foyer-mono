import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import type { EntryWorkflowError } from "./errors";
import { expandHome } from "./paths";
import { FileSystem } from "../services/context";

function scanRootsFile(): string {
  return process.env.FOYER_SCAN_ROOTS_FILE ?? path.join(os.homedir(), ".foyer", "scan-roots.json");
}
export const DEFAULT_PROJECTS_ROOT = path.join(os.homedir(), "repo", "projects");

interface ScanRootsData {
  roots: string[];
}

function contractHome(p: string): string {
  const home = os.homedir();
  if (p === home) return "~";
  if (p.startsWith(home + path.sep)) return "~/" + p.slice(home.length + 1);
  return p;
}

function readExpanded(
  fs: import("../services/context").FileSystemService,
): Effect.Effect<string[], EntryWorkflowError> {
  return Effect.gen(function* () {
    const file = scanRootsFile();
    if (!(yield* fs.exists(file))) return [DEFAULT_PROJECTS_ROOT];
    const raw = yield* fs.readFile(file);
    const data = JSON.parse(raw) as ScanRootsData;
    return data.roots.map((r) => path.resolve(expandHome(r)));
  });
}

function writeExpanded(
  fs: import("../services/context").FileSystemService,
  roots: string[],
): Effect.Effect<void, EntryWorkflowError> {
  return fs.writeFile(
    scanRootsFile(),
    JSON.stringify({ roots: roots.map(contractHome) }, null, 2) + "\n",
  );
}

export interface ScanRootsResult {
  roots: string[];
  humanOutputZh: string;
  humanSummaryZh: string;
}

export interface ScanRootsMutateResult extends ScanRootsResult {
  changed: boolean;
}

export function repoRootsList(): Effect.Effect<ScanRootsResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const roots = yield* readExpanded(fs);
    return {
      roots,
      humanOutputZh: roots.map((r) => `  ${r}`).join("\n") + "\n",
      humanSummaryZh: `共 ${roots.length} 个扫描根目录。`,
    };
  });
}

export function repoRootsAdd(
  root: string,
): Effect.Effect<ScanRootsMutateResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const current = yield* readExpanded(fs);
    const resolved = path.resolve(expandHome(root));
    if (current.includes(resolved)) {
      return {
        roots: current,
        changed: false,
        humanOutputZh: `  ${resolved}\n`,
        humanSummaryZh: `${resolved} 已在列表中，未更改。`,
      };
    }
    const newRoots = [...current, resolved];
    yield* writeExpanded(fs, newRoots);
    return {
      roots: newRoots,
      changed: true,
      humanOutputZh: newRoots.map((r) => `  ${r}`).join("\n") + "\n",
      humanSummaryZh: `已添加 ${resolved}，共 ${newRoots.length} 个扫描根目录。`,
    };
  });
}

export function repoRootsRemove(
  root: string,
): Effect.Effect<ScanRootsMutateResult, EntryWorkflowError, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem;
    const current = yield* readExpanded(fs);
    const resolved = path.resolve(expandHome(root));
    const filtered = current.filter((r) => r !== resolved);
    if (filtered.length === current.length) {
      return {
        roots: current,
        changed: false,
        humanOutputZh: current.map((r) => `  ${r}`).join("\n") + "\n",
        humanSummaryZh: `${resolved} 不在列表中，未更改。`,
      };
    }
    if (filtered.length === 0) {
      return {
        roots: current,
        changed: false,
        humanOutputZh: current.map((r) => `  ${r}`).join("\n") + "\n",
        humanSummaryZh: `无法移除 ${resolved}：至少需要保留一个扫描根目录。`,
      };
    }
    yield* writeExpanded(fs, filtered);
    return {
      roots: filtered,
      changed: true,
      humanOutputZh: filtered.map((r) => `  ${r}`).join("\n") + "\n",
      humanSummaryZh: `已移除 ${resolved}，剩余 ${filtered.length} 个扫描根目录。`,
    };
  });
}
