import os from "node:os";
import path from "node:path";
import type { RuntimeConfig } from "./contracts";

export const DEFAULT_FOYER_ROOT = "~/.foyer";

export function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveConfig(overrides: {
  projectsRoot?: string;
  foyerRoot?: string;
  entryRoot?: string;
  githubOwner?: string;
  githubVisibility?: RuntimeConfig["githubVisibility"];
  deviceName?: string;
}): RuntimeConfig {
  return {
    projectsRoot: path.resolve(
      expandHome(overrides.projectsRoot ?? process.env.PROJECTS_ROOT ?? "~/repo/projects"),
    ),
    entryRoot: path.resolve(
      expandHome(
        overrides.foyerRoot ??
          overrides.entryRoot ??
          process.env.FOYER_ROOT ??
          process.env.ENTRY_ROOT ??
          DEFAULT_FOYER_ROOT,
      ),
    ),
    githubOwner: overrides.githubOwner ?? process.env.GITHUB_OWNER,
    githubVisibility:
      overrides.githubVisibility ?? normalizeVisibility(process.env.GITHUB_VISIBILITY),
    deviceName: overrides.deviceName ?? process.env.DEVICE_NAME ?? os.hostname(),
  };
}

export function projectPath(config: RuntimeConfig, slug: string): string {
  return path.join(config.projectsRoot, slug);
}

export function relativeToEntry(config: RuntimeConfig, absolutePath: string): string {
  return path.relative(config.entryRoot, absolutePath).split(path.sep).join("/");
}

export function todayParts(date: Date): { yyyy: string; mm: string; dd: string; ymd: string } {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd, ymd: `${yyyy}-${mm}-${dd}` };
}

export function entryPaths(config: RuntimeConfig, slug: string, date: Date) {
  const { yyyy, mm, dd, ymd } = todayParts(date);
  const safeDevice = config.deviceName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return {
    eventFile: path.join(
      config.entryRoot,
      "activity",
      "events",
      safeDevice,
      yyyy,
      mm,
      `${dd}.jsonl`,
    ),
    projectPage: path.join(config.entryRoot, "projects", `${slug}.md`),
    projectIndex: path.join(config.entryRoot, "projects", "index.md"),
    inboxFile: path.join(config.entryRoot, "inbox", yyyy, mm, `${ymd}.md`),
    derivedRoot: path.join(config.entryRoot, "activity", "derived"),
  };
}

function normalizeVisibility(value: string | undefined): RuntimeConfig["githubVisibility"] {
  if (value === "public" || value === "internal" || value === "private") return value;
  return "private";
}
