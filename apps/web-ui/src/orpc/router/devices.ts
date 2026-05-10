import { os } from "@orpc/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const FOYER_PATH = join(homedir(), "Library/pnpm/foyer");

export interface Repo {
  repo: string;
  path: string;
  scanRoot: string;
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
}

interface FoyerOutput {
  ok: boolean;
  data: {
    devices: FoyerDevice[];
  };
}

export const listDevices = os.handler(async () => {
  try {
    const { stdout } = await execFileAsync(
      FOYER_PATH,
      ["repo", "devices", "--all-roots", "--json"],
      {
        env: { ...process.env, HOME: homedir() },
      },
    );

    const result = JSON.parse(stdout) as FoyerOutput;
    if (!result.ok) return [] as ScanRoot[];

    // group by scanRoot
    const map = new Map<string, Repo[]>();
    for (const d of result.data.devices) {
      const list = map.get(d.scanRoot) ?? [];
      list.push({ repo: d.repo, path: d.path, scanRoot: d.scanRoot });
      map.set(d.scanRoot, list);
    }

    return Array.from(map.entries()).map(([path, repos]) => ({ path, repos }));
  } catch (e) {
    process.stderr.write(`[devices] ${String(e)}\n`);
    return [] as ScanRoot[];
  }
});
