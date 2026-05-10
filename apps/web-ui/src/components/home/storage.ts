import type { RepoTag } from "./types";

const CAT_PREFIX = "foyer.repo.cat.";
const CLICK_PREFIX = "foyer.repo.click.";
const WORK_DIRS_KEY = "foyer.work-dirs";

export function readAllTags(): Record<string, RepoTag> {
  const result: Record<string, RepoTag> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CAT_PREFIX)) continue;
      const path = key.slice(CAT_PREFIX.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        result[path] = JSON.parse(raw) as RepoTag;
      } catch {
        /* skip */
      }
    }
  } catch {}
  return result;
}

export function writeTag(path: string, tag: RepoTag | null) {
  if (tag === null) localStorage.removeItem(CAT_PREFIX + path);
  else localStorage.setItem(CAT_PREFIX + path, JSON.stringify(tag));
}

export function readWorkDirs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WORK_DIRS_KEY) ?? '["方向A","方向B"]') as string[];
  } catch {
    return ["方向A", "方向B"];
  }
}
export function writeWorkDirs(dirs: string[]) {
  localStorage.setItem(WORK_DIRS_KEY, JSON.stringify(dirs));
}

export function getClickCount(path: string) {
  try {
    return parseInt(localStorage.getItem(CLICK_PREFIX + path) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}
export function incClickCount(path: string) {
  const n = getClickCount(path) + 1;
  try {
    localStorage.setItem(CLICK_PREFIX + path, String(n));
  } catch {}
  return n;
}
