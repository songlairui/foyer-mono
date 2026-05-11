import type { CategoryDef, RepoTag } from "./types";

const CAT_PREFIX = "foyer.repo.cat.";
const CLICK_PREFIX = "foyer.repo.click.";
const CATEGORIES_KEY = "foyer.categories";
const HIDDEN_SUBS_KEY = "foyer.hidden-subs";

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
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if ("category" in parsed && !("categoryId" in parsed)) {
          result[path] = {
            categoryId: parsed.category as string,
            subCategory: parsed.workDir as string | undefined,
          };
        } else {
          result[path] = parsed as unknown as RepoTag;
        }
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

export function readCategories(): CategoryDef[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) return JSON.parse(raw) as CategoryDef[];
  } catch {
    /* fall through to defaults */
  }
  const oldWorkDirs: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("foyer.work-dirs") ?? '["方向A","方向B"]') as string[];
    } catch {
      return ["方向A", "方向B"];
    }
  })();
  return [
    {
      id: "goal",
      label: "Goal",
      icon: "Star",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      subCategories: [],
    },
    {
      id: "work",
      label: "工作",
      icon: "Briefcase",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      subCategories: oldWorkDirs,
    },
    {
      id: "life",
      label: "生活",
      icon: "Home",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      subCategories: [],
    },
    {
      id: "explore",
      label: "探索",
      icon: "Compass",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      subCategories: [],
    },
  ];
}

export function writeCategories(cats: CategoryDef[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export function readHiddenSubs(): Record<string, Set<string>> {
  try {
    const raw = localStorage.getItem(HIDDEN_SUBS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [catId, subs] of Object.entries(parsed)) {
      result[catId] = new Set(subs);
    }
    return result;
  } catch {
    return {};
  }
}

export function writeHiddenSubs(hidden: Record<string, Set<string>>) {
  const obj: Record<string, string[]> = {};
  for (const [catId, subs] of Object.entries(hidden)) {
    if (subs.size > 0) obj[catId] = [...subs];
  }
  if (Object.keys(obj).length === 0) localStorage.removeItem(HIDDEN_SUBS_KEY);
  else localStorage.setItem(HIDDEN_SUBS_KEY, JSON.stringify(obj));
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
