import { spawnSync } from "node:child_process";

export const triggers = { webhook: true };

interface FlueContext {
  payload: unknown;
}

export interface ProjectInitPayload {
  slug: string;
  description: string;
  lane?: string;
  owner?: "me" | "wife" | "both";
  github?: boolean;
  confirm?: boolean;
}

export function plan(payload: ProjectInitPayload) {
  return runFoyer(payload, true);
}

export function execute(payload: ProjectInitPayload) {
  if (!payload.confirm) {
    return {
      ok: false,
      needsConfirmation: true,
      messageZh: "执行项目初始化前需要确认。请先查看 dry-run 计划。",
    };
  }
  return runFoyer(payload, false);
}

export default async function ({ payload }: FlueContext) {
  const request = payload as ProjectInitPayload;
  return request.confirm ? execute(request) : plan(request);
}

function runFoyer(payload: ProjectInitPayload, dryRun: boolean) {
  const args = [
    "project",
    "init",
    payload.slug,
    "--desc",
    payload.description,
    "--lane",
    payload.lane ?? "project",
    "--owner",
    payload.owner ?? "me",
    "--json",
  ];

  if (payload.github) args.push("--github");
  if (dryRun) args.push("--dry-run");

  const cli = process.env.FOYER_CLI ?? process.env.ENTRY_INIT_PROJECT_CLI ?? "foyer";
  const command = cli.endsWith(".js") ? process.execPath : cli;
  const finalArgs = cli.endsWith(".js") ? [cli, ...args] : args;
  const result = spawnSync(command, finalArgs, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
