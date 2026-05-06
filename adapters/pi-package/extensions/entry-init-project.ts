import { spawnSync } from "node:child_process";

export interface ProjectInitCommandInput {
  slug: string;
  description: string;
  lane?: string;
  owner?: "me" | "wife" | "both";
  github?: boolean;
  dryRun?: boolean;
}

export function runFoyerProjectInit(input: ProjectInitCommandInput) {
  const args = [
    "project",
    "init",
    input.slug,
    "--desc",
    input.description,
    "--lane",
    input.lane ?? "project",
    "--owner",
    input.owner ?? "me",
    "--json"
  ];

  if (input.github) args.push("--github");
  if (input.dryRun ?? true) args.push("--dry-run");

  const result = spawnSync("foyer", args, {
    encoding: "utf8"
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}
