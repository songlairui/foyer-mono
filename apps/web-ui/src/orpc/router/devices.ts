import { os } from "@orpc/server";
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FOYER_PATH = join(homedir(), "Library/pnpm/foyer");

export interface Worktree {
  path: string;
  branch: string;
  bare: boolean;
  head: string;
}

export interface Repo {
  repo: string;
  path: string;
  scanRoot: string;
  description?: string;
  lane?: string;
  slug?: string;
  lastModified?: number;
  worktrees?: Worktree[];
}

export interface ScanRoot {
  path: string;
  repos: Repo[];
}

interface FoyerDevice {
  device: string;
  repo: string;
  path: string;
  scanRoot: string;
  worktrees?: Array<{
    path: string;
    branch: string;
    bare: boolean;
    head: string;
  }>;
}

interface FoyerOutput {
  ok: boolean;
  data: {
    devices: FoyerDevice[];
  };
}

interface FoyerProject {
  slug: string;
  description: string;
  lane: string;
  projectPath: string;
}

interface FoyerListOutput {
  ok: boolean;
  data: {
    projects: FoyerProject[];
  };
}

async function getLastModified(repoPath: string): Promise<number> {
  try {
    const commitMsgStat = await stat(join(repoPath, ".git", "COMMIT_EDITMSG"));
    return commitMsgStat.mtimeMs;
  } catch {
    try {
      const repoStat = await stat(repoPath);
      return repoStat.mtimeMs;
    } catch {
      return 0;
    }
  }
}

export const listDevices = os.handler(async () => {
  try {
    const execEnv = { env: { ...process.env, HOME: homedir() } };

    const [devicesResult, listResult] = await Promise.all([
      execFileAsync(
        FOYER_PATH,
        ["repo", "devices", "--all-roots", "--json", "--with-worktrees"],
        execEnv,
      ),
      execFileAsync(FOYER_PATH, ["repo", "list", "--json"], execEnv).catch(() => ({
        stdout: '{"ok":false,"data":{"projects":[]}}',
      })),
    ]);

    const devicesOutput = JSON.parse(devicesResult.stdout) as FoyerOutput;
    if (!devicesOutput.ok) return [] as ScanRoot[];

    const listOutput = JSON.parse(listResult.stdout) as FoyerListOutput;
    const projectMap = new Map<string, FoyerProject>();
    if (listOutput.ok) {
      for (const p of listOutput.data.projects) {
        projectMap.set(p.projectPath, p);
      }
    }

    const devices = devicesOutput.data.devices;

    const repos: Repo[] = await Promise.all(
      devices.map(async (d) => {
        const project = projectMap.get(d.path);
        const lastModified = await getLastModified(d.path);
        return {
          repo: d.repo,
          path: d.path,
          scanRoot: d.scanRoot,
          description: project?.description,
          lane: project?.lane,
          slug: project?.slug,
          lastModified,
          worktrees: d.worktrees?.map((w) => ({
            path: w.path,
            branch: w.branch,
            bare: w.bare,
            head: w.head,
          })),
        };
      }),
    );

    const map = new Map<string, Repo[]>();
    for (const repo of repos) {
      const list = map.get(repo.scanRoot) ?? [];
      list.push(repo);
      map.set(repo.scanRoot, list);
    }

    return Array.from(map.entries()).map(([path, repoList]) => ({
      path,
      repos: repoList,
    }));
  } catch (e) {
    process.stderr.write(`[devices] ${String(e)}\n`);
    return [] as ScanRoot[];
  }
});
