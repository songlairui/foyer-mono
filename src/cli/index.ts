#!/usr/bin/env node
import { Command } from "commander";
import { Effect } from "effect";
import { readFileSync } from "node:fs";
import { appendActivity, activityContext, exportActivity, queryActivity, searchActivity } from "../workflows/activity";
import { appendInbox } from "../workflows/inbox";
import { executeProjectInit, planProjectInit, upsertProjectIndex } from "../workflows/project-init";
import { repoDevices, repoManifests, repoStatus } from "../workflows/repo";
import { Clock, FileSystem, NodeServicesLive, Shell } from "../services/context";
import { errorToJson, exitCodeFor } from "../domain/errors";

type OutputMode = { json?: boolean };

const program = new Command();

program
  .name("entry")
  .description("entry 项目初始化、activity 记录和派生导出 CLI")
  .version("0.1.0");

const project = program.command("project").description("项目初始化和索引命令");

project
  .command("init")
  .argument("<slug>", "kebab-case 项目名")
  .description("初始化项目；支持 dry-run、稳定 JSON 输出和可恢复错误")
  .requiredOption("--desc <text>", "中文项目描述")
  .option("--lane <lane>", "entry lane", "project")
  .option("--owner <owner>", "owner: me / wife / both", "me")
  .option("--projects-root <path>", "项目根目录")
  .option("--entry-root <path>", "entry 根目录")
  .option("--github-owner <owner>", "GitHub owner")
  .option("--github-visibility <visibility>", "private / public / internal", "private")
  .option("--github", "创建 GitHub 仓库并 push", false)
  .option("--dry-run", "只打印计划，不产生副作用", false)
  .option("--json", "输出稳定 JSON")
  .action(async (slug: string, options: Record<string, unknown>) => {
    const input = {
      slug,
      description: options.desc,
      lane: options.lane,
      owner: options.owner,
      projectsRoot: options.projectsRoot,
      entryRoot: options.entryRoot,
      githubOwner: options.githubOwner,
      githubVisibility: options.githubVisibility,
      createGithub: Boolean(options.github),
      dryRun: Boolean(options.dryRun)
    };
    if (options.dryRun) {
      await run(planProjectInit(input), options);
      return;
    }
    await run(executeProjectInit(input), options);
  });

project
  .command("plan")
  .requiredOption("--input <path>", "request.json 路径")
  .option("--json", "输出稳定 JSON", true)
  .description("从 JSON request 生成初始化计划")
  .action(async (options) => {
    const input = JSON.parse(readFileSync(options.input, "utf8"));
    await run(planProjectInit({ ...input, dryRun: true }), options);
  });

project
  .command("upsert-index")
  .argument("<slug>", "项目名")
  .requiredOption("--desc <text>", "项目描述")
  .option("--lane <lane>", "entry lane", "project")
  .option("--owner <owner>", "owner: me / wife / both", "me")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("更新或生成 projects/index.md")
  .action(async (slug, options) => {
    await run(upsertProjectIndex({ slug, description: options.desc, lane: options.lane, owner: options.owner, entryRoot: options.entryRoot }), options);
  });

const inbox = program.command("inbox").description("inbox 追加命令");

inbox
  .command("append")
  .requiredOption("--project <slug>", "项目名")
  .option("--raw-file <path>", "原始文本文件路径")
  .option("--text <text>", "直接追加的文本")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("追加 inbox 记录，并写入 activity event")
  .action(async (options) => {
    await run(appendInbox({ project: options.project, rawFile: options.rawFile, text: options.text, entryRoot: options.entryRoot }), options);
  });

const activity = program.command("activity").description("activity event 查询、上下文和导出");

activity
  .command("append")
  .requiredOption("--event <event>", "event 类型，例如 project.created")
  .option("--project <slug>", "项目名")
  .requiredOption("--summary <text>", "中文摘要")
  .option("--lane <lane>", "entry lane")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("追加 machine-readable activity event")
  .action(async (options) => {
    await run(appendActivity({ event: options.event, project: options.project, summary: options.summary, lane: options.lane, entryRoot: options.entryRoot }), options);
  });

activity
  .command("query")
  .option("--project <slug>", "项目名")
  .option("--event <event>", "event 类型")
  .option("--since <iso>", "ISO 起始时间")
  .option("--limit <n>", "最大返回数量", parseInteger, 100)
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("通过 CLI 查询 activity event；agent 不应直接读取 raw jsonl")
  .action(async (options) => {
    await run(queryActivity({ project: options.project, event: options.event, since: options.since, limit: options.limit, entryRoot: options.entryRoot }), options);
  });

activity
  .command("context")
  .requiredOption("--project <slug>", "项目名")
  .option("--budget <n>", "上下文预算，按字符近似裁剪", parseInteger, 6000)
  .option("--format <format>", "markdown / json", "markdown")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("生成低上下文项目材料")
  .action(async (options) => {
    await run(activityContext({ project: options.project, budget: options.budget, format: options.format, entryRoot: options.entryRoot }), options);
  });

activity
  .command("export")
  .requiredOption("--scope <scope>", "project:<slug> 或 all-projects")
  .requiredOption("--target <target>", "graphify-corpus / hyperextract-input / hyperextract-ka / fts-index")
  .option("--out <path>", "输出路径")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("导出可重建派生物，不能回写为事实源")
  .action(async (options) => {
    await run(exportActivity({ scope: options.scope, target: options.target, out: options.out, entryRoot: options.entryRoot }), options);
  });

const repo = program.command("repo").description("设备和仓库状态查询");

repo
  .command("devices")
  .option("--projects-root <path>", "项目根目录")
  .option("--json", "输出稳定 JSON")
  .description("扫描当前设备上的项目仓库")
  .action(async (options) => {
    await run(repoDevices({ projectsRoot: options.projectsRoot }), options);
  });

repo
  .command("status")
  .option("--all", "扫描所有仓库", true)
  .option("--projects-root <path>", "项目根目录")
  .option("--json", "输出稳定 JSON")
  .description("查询项目仓库 git status")
  .action(async (options) => {
    await run(repoStatus({ projectsRoot: options.projectsRoot, all: options.all }), options);
  });

repo
  .command("manifests")
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("通过 CLI 扫描 activity/manifests，供跨设备拼接使用")
  .action(async (options) => {
    await run(repoManifests({ entryRoot: options.entryRoot }), options);
  });

program
  .command("search")
  .argument("<query>", "搜索词")
  .option("--project <slug>", "项目名")
  .option("--limit <n>", "最大返回数量", parseInteger, 10)
  .option("--entry-root <path>", "entry 根目录")
  .option("--json", "输出稳定 JSON")
  .description("等价本地搜索派生层查询，返回精确引用")
  .action(async (query, options) => {
    await run(searchActivity({ query, project: options.project, limit: options.limit, entryRoot: options.entryRoot }), options);
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

type RuntimeServices = FileSystem | Shell | Clock;

async function run<A, E>(effect: Effect.Effect<A, E, RuntimeServices>, options: OutputMode): Promise<void> {
  const runnable = Effect.provide(effect, NodeServicesLive);
  const exit = await Effect.runPromiseExit(runnable);
  if (exit._tag === "Success") {
    writeSuccess(exit.value, options);
    return;
  }

  const json = errorToJson(exit);
  process.exitCode = exitCodeFor(exit);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
    return;
  }
  const error = json.error as { messageZh?: string };
  process.stderr.write(`${error.messageZh ?? "命令失败。"}\n`);
}

function writeSuccess(value: unknown, options: OutputMode): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, data: value }, null, 2)}\n`);
    return;
  }
  if (typeof value === "string") {
    process.stdout.write(value);
    return;
  }
  const humanSummaryZh = typeof value === "object" && value && "humanSummaryZh" in value ? String((value as { humanSummaryZh: unknown }).humanSummaryZh) : "命令执行完成。";
  process.stdout.write(`${humanSummaryZh}\n`);
}

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}
