#!/usr/bin/env node
import { Command } from "commander";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import {
  appendActivity,
  activityContext,
  exportActivity,
  queryActivity,
  searchActivity,
} from "../workflows/activity";
import { runDoctor } from "../workflows/doctor";
import { appendInbox, sendInbox } from "../workflows/inbox";
import {
  executeProjectInit,
  listProjects,
  planProjectInit,
  upsertProjectIndex,
} from "../workflows/project-init";
import {
  repoDevices,
  repoDevicesMulti,
  repoManifests,
  repoPrepare,
  repoStatus,
} from "../workflows/repo";
import { repoRootsAdd, repoRootsList, repoRootsRemove } from "../domain/scan-roots";
import { openProject, setOpener, KNOWN_OPENERS } from "../workflows/open";
import { Clock, FileSystem, NodeServicesLive, Shell } from "../services/context";
import { errorToJson, exitCodeFor } from "../domain/errors";

type OutputMode = { json?: boolean };

const program = new Command();

program.name("foyer").description("Foyer 项目落户、activity 记录和派生导出 CLI").version("0.1.0");

const project = program
  .command("project")
  .description("项目初始化和索引命令（已废弃，project 概念将重新设计）");

project
  .command("init")
  .argument("<slug>", "kebab-case 项目名")
  .description("初始化项目；支持 dry-run、稳定 JSON 输出和可恢复错误")
  .requiredOption("--desc <text>", "中文项目描述")
  .option("--lane <lane>", "项目 lane", "project")
  .option("--owner <owner>", "owner: me / wife / both", "me")
  .option("--projects-root <path>", "项目根目录")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--github-owner <owner>", "GitHub owner")
  .option("--github-visibility <visibility>", "private / public / internal", "private")
  .option("--github", "创建 GitHub 仓库并 push", false)
  .option("--dry-run", "只打印计划，不产生副作用", false)
  .option("--init-from <value>", "发起位置标识，格式为 username/repo 或 Foyer slug")
  .option("--json", "输出稳定 JSON")
  .action(async (slug: string, options: Record<string, unknown>) => {
    const input = {
      slug,
      description: options.desc,
      lane: options.lane,
      owner: options.owner,
      projectsRoot: options.projectsRoot,
      entryRoot: rootOption(options),
      githubOwner: options.githubOwner,
      githubVisibility: options.githubVisibility,
      createGithub: Boolean(options.github),
      dryRun: Boolean(options.dryRun),
      initFrom: options.initFrom as string | undefined,
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
  .command("list")
  .option("--limit <n>", "最大返回数量", parseInteger, 1000)
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("列出已经落户/启动过的项目（已废弃，请使用 foyer repo list）")
  .action(async (options) => {
    process.stderr.write("警告：foyer project list 已废弃，请使用 foyer repo list\n");
    await run(listProjects({ limit: options.limit, entryRoot: rootOption(options) }), options);
  });

project
  .command("upsert-index")
  .argument("<slug>", "项目名")
  .requiredOption("--desc <text>", "项目描述")
  .option("--lane <lane>", "项目 lane", "project")
  .option("--owner <owner>", "owner: me / wife / both", "me")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("更新或生成 projects/index.md")
  .action(async (slug, options) => {
    await run(
      upsertProjectIndex({
        slug,
        description: options.desc,
        lane: options.lane,
        owner: options.owner,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

const inbox = program.command("inbox").description("inbox 追加命令");

inbox
  .command("append")
  .requiredOption("--project <slug>", "项目名")
  .option("--raw-file <path>", "原始文本文件路径")
  .option("--text <text>", "直接追加的文本")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("追加 inbox 记录，并写入 activity event")
  .action(async (options) => {
    await run(
      appendInbox({
        project: options.project,
        rawFile: options.rawFile,
        text: options.text,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

inbox
  .command("send")
  .argument("<slug>", "目标项目 slug")
  .requiredOption("--type <type>", "消息类型: feature-request | feedback | idea | notify")
  .requiredOption("--title <text>", "条目标题")
  .option("--text <text>", "正文内容")
  .option("--raw-file <path>", "原始 md 文件路径")
  .option("--source-project <slug>", "来源项目 slug")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("向指定项目的 _inbox/tapped/ 投递一条信息条目")
  .action(async (slug, options) => {
    await run(
      sendInbox({
        targetSlug: slug,
        type: options.type,
        title: options.title,
        text: options.text,
        rawFile: options.rawFile,
        sourceProject: options.sourceProject,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

const activity = program.command("activity").description("activity event 查询、上下文和导出");

activity
  .command("append")
  .requiredOption("--event <event>", "event 类型，例如 project.created")
  .option("--project <slug>", "项目名")
  .requiredOption("--summary <text>", "中文摘要")
  .option("--lane <lane>", "项目 lane")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("追加 machine-readable activity event")
  .action(async (options) => {
    await run(
      appendActivity({
        event: options.event,
        project: options.project,
        summary: options.summary,
        lane: options.lane,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

activity
  .command("query")
  .option("--project <slug>", "项目名")
  .option("--event <event>", "event 类型")
  .option("--since <iso>", "ISO 起始时间")
  .option("--limit <n>", "最大返回数量", parseInteger, 100)
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("通过 CLI 查询 activity event；agent 不应直接读取 raw jsonl")
  .action(async (options) => {
    await run(
      queryActivity({
        project: options.project,
        event: options.event,
        since: options.since,
        limit: options.limit,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

activity
  .command("context")
  .requiredOption("--project <slug>", "项目名")
  .option("--budget <n>", "上下文预算，按字符近似裁剪", parseInteger, 6000)
  .option("--format <format>", "markdown / json", "markdown")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("生成低上下文项目材料")
  .action(async (options) => {
    await run(
      activityContext({
        project: options.project,
        budget: options.budget,
        format: options.format,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

activity
  .command("export")
  .requiredOption("--scope <scope>", "project:<slug> 或 all-projects")
  .requiredOption(
    "--target <target>",
    "graphify-corpus / hyperextract-input / hyperextract-ka / fts-index",
  )
  .option("--out <path>", "输出路径")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("导出可重建派生物，不能回写为事实源")
  .action(async (options) => {
    await run(
      exportActivity({
        scope: options.scope,
        target: options.target,
        out: options.out,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

const repo = program.command("repo").description("仓库扫描、状态查询和根目录管理");

repo
  .command("list")
  .option("--limit <n>", "最大返回数量", parseInteger, 1000)
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .option("--tui", "使用交互式终端界面展示")
  .description("列出已经落户/启动过的项目")
  .action(async (options) => {
    if (options.tui) {
      await runTui(listProjects({ limit: options.limit, entryRoot: rootOption(options) }));
      return;
    }
    await run(listProjects({ limit: options.limit, entryRoot: rootOption(options) }), options);
  });

const roots = repo.command("roots").description("管理多目录扫描根列表");

roots
  .command("list")
  .option("--json", "输出稳定 JSON")
  .description("列出当前注册的扫描根目录")
  .action(async (options) => {
    await run(repoRootsList(), options);
  });

roots
  .command("add")
  .argument("<path>", "要添加的根目录路径（支持 ~ 前缀）")
  .option("--json", "输出稳定 JSON")
  .description("注册新的扫描根目录")
  .action(async (rootPath, options) => {
    await run(repoRootsAdd(rootPath), options);
  });

roots
  .command("remove")
  .argument("<path>", "要移除的根目录路径（支持 ~ 前缀）")
  .option("--json", "输出稳定 JSON")
  .description("移除已注册的扫描根目录（至少保留一个）")
  .action(async (rootPath, options) => {
    await run(repoRootsRemove(rootPath), options);
  });

repo
  .command("devices")
  .option("--projects-root <path>", "项目根目录（单根模式，不指定则用默认）")
  .option("--all-roots", "扫描所有已注册的根目录", false)
  .option("--json", "输出稳定 JSON")
  .description("扫描当前设备上的项目仓库")
  .action(async (options) => {
    if (options.allRoots) {
      await run(
        repoRootsList().pipe(Effect.flatMap((r) => repoDevicesMulti({ roots: r.roots }))),
        options,
      );
    } else {
      await run(repoDevices({ projectsRoot: options.projectsRoot }), options);
    }
  });

repo
  .command("status")
  .option("--all", "扫描所有仓库", true)
  .option("--projects-root <path>", "项目根目录（单根模式）")
  .option("--all-roots", "扫描所有已注册的根目录", false)
  .option("--json", "输出稳定 JSON")
  .description("查询项目仓库 git status")
  .action(async (options) => {
    if (options.allRoots) {
      await run(
        repoRootsList().pipe(
          Effect.flatMap((r) => repoStatus({ roots: r.roots, all: options.all })),
        ),
        options,
      );
    } else {
      await run(repoStatus({ projectsRoot: options.projectsRoot, all: options.all }), options);
    }
  });

repo
  .command("manifests")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("通过 CLI 扫描 activity/manifests，供跨设备拼接使用")
  .action(async (options) => {
    await run(repoManifests({ entryRoot: rootOption(options) }), options);
  });

repo
  .command("prepare")
  .argument("<slug>", "kebab-case 项目名")
  .option("--projects-root <path>", "项目根目录")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--dry-run", "只打印计划，不产生副作用", false)
  .option("--json", "输出稳定 JSON")
  .description("确保指定项目仓库在本地就绪，未 clone 则自动 clone")
  .action(async (slug, options) => {
    await run(
      repoPrepare({
        slug,
        projectsRoot: options.projectsRoot,
        foyerRoot: rootOption(options),
        entryRoot: rootOption(options),
        dryRun: Boolean(options.dryRun),
      }),
      options,
    );
  });

program
  .command("doctor")
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--projects-root <path>", "项目根目录")
  .option("--project <slug>", "只查看某个项目的 activity event")
  .option("--limit <n>", "最近事件数量", parseInteger, 10)
  .option("--json", "输出稳定 JSON")
  .description("只读 dashboard：列出 Foyer 历史数据、sidecar、视图、派生物和本地仓库状态")
  .action(async (options) => {
    await run(
      runDoctor({
        entryRoot: rootOption(options),
        projectsRoot: options.projectsRoot,
        project: options.project,
        limit: options.limit,
      }),
      options,
    );
  });

program
  .command("search")
  .argument("<query>", "搜索词")
  .option("--project <slug>", "项目名")
  .option("--limit <n>", "最大返回数量", parseInteger, 10)
  .option("--foyer-root <path>", "Foyer 数据根目录")
  .option("--entry-root <path>", "兼容旧参数：旧数据根目录")
  .option("--json", "输出稳定 JSON")
  .description("等价本地搜索派生层查询，返回精确引用")
  .action(async (query, options) => {
    await run(
      searchActivity({
        query,
        project: options.project,
        limit: options.limit,
        entryRoot: rootOption(options),
      }),
      options,
    );
  });

program
  .command("open")
  .argument("<slug>", "kebab-case 项目名")
  .option("--json", "输出稳定 JSON")
  .description("用配置的编辑器打开项目目录")
  .action(async (slug, options) => {
    await run(openProject(slug), options);
  });

const candidates = Object.entries(KNOWN_OPENERS)
  .map(([cmd, name]) => `  ${cmd.padEnd(12)} ${name}`)
  .join("\n");

program
  .command("set-opener")
  .argument("<opener>", `编辑器命令。候选:\n${candidates}`)
  .option("--json", "输出稳定 JSON")
  .description("设置 foyer open 使用的编辑器命令")
  .action(async (opener, options) => {
    await run(setOpener(opener), options);
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

type RuntimeServices = FileSystem | Shell | Clock;

async function run<A, E>(
  effect: Effect.Effect<A, E, RuntimeServices>,
  options: OutputMode,
): Promise<void> {
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
  if (typeof value === "object" && value && "humanOutputZh" in value) {
    process.stdout.write(String((value as { humanOutputZh: unknown }).humanOutputZh));
    return;
  }
  const humanSummaryZh =
    typeof value === "object" && value && "humanSummaryZh" in value
      ? String((value as { humanSummaryZh: unknown }).humanSummaryZh)
      : "命令执行完成。";
  process.stdout.write(`${humanSummaryZh}\n`);
}

async function runTui<A, E>(effect: Effect.Effect<A, E, RuntimeServices>): Promise<void> {
  const runnable = Effect.provide(effect, NodeServicesLive);
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === "Failure") {
    const json = errorToJson(exit);
    process.exitCode = exitCodeFor(exit);
    const error = json.error as { messageZh?: string };
    process.stderr.write(`${error.messageZh ?? "命令失败。"}\n`);
    return;
  }

  const tmpFile = join(tmpdir(), `foyer-repo-list-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(exit.value));

  const tuiScript = join(__dirname, "..", "..", "tui", "repo-list.ts");

  await new Promise<void>((resolve) => {
    const child = spawn("bun", ["run", tuiScript, tmpFile], {
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("error", (err) => {
      unlinkSync(tmpFile);
      process.stderr.write(`无法启动 TUI：${err.message}（请确认已安装 Bun）\n`);
      resolve();
    });

    child.on("close", () => {
      try {
        unlinkSync(tmpFile);
      } catch {
        // temp file may already be cleaned up
      }
      resolve();
    });
  });
}

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}

function rootOption(options: { foyerRoot?: string; entryRoot?: string }): string | undefined {
  return options.foyerRoot ?? options.entryRoot;
}
