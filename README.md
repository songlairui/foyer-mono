# entry-init-project

`entry-init-project` 把原本靠长篇 prose skill 执行的项目初始化流程，收敛成一个可测试、可 dry-run、可被多宿主调用的 TypeScript/Effect CLI。

核心边界是 `entry` CLI。当前推荐入口是 CLI 和瘦身版 skill；Claude Code plugin、Pi package/extension 和 Flue agent 先保留为调研与未来交付边界，不作为当前必要安装项。

## 当前能力

- `entry project init <slug> --desc <text> --dry-run --json` 输出完整执行计划。
- `entry project init <slug> --desc <text>` 创建本地项目、中文 README、`docs/kickoff/`、Git 首次提交、activity event 和 Markdown 视图。
- `--github` 可选调用 `gh repo create` 创建远端仓库并 push。
- `entry activity query/context/export` 提供低上下文查询、Markdown context、graphify/Hyper-Extract/本地搜索索引导出。
- `entry inbox append`、`entry project upsert-index`、`entry repo devices/status/manifests`、`entry doctor`、`entry search` 覆盖最小 entry 辅助接口。

## 使用方式

### CLI

CLI 是稳定边界，适合人、agent、CI 和未来宿主 adapter 调用。初始化项目时先看计划：

```bash
entry project init demo-project --desc "用于承接一个新项目的启动资料" --dry-run --json
```

确认计划后执行：

```bash
entry project init demo-project --desc "用于承接一个新项目的启动资料" --json
```

需要创建 GitHub 仓库时显式开启远端动作：

```bash
entry project init demo-project --desc "用于承接一个新项目的启动资料" --github --github-owner <owner> --json
```

查询历史记录时不要直接读取 `activity/events/**/*.jsonl`，通过 CLI 获取裁剪后的视图：

```bash
entry activity query --project demo-project --json
entry activity context --project demo-project --budget 6000 --format markdown
entry search "启动资料" --project demo-project --json
```

只读 dashboard / doctor 用于列出当前数据面，不写入任何历史文件：

```bash
entry doctor --json
entry doctor --project demo-project --json
```

doctor 会汇总 entry 根目录、activity event、nodes/frontier/manifests、Markdown 视图、derived 文件、本地 repo 状态和 warnings。

### Skill

日常让 code agent 接管“新建项目目录组织的心理负担”时，优先使用 `skills/init-project/SKILL.md`。Skill 只做三件事：

- 理解自然语言意图，提取或生成 `slug`、`description`、`lane`、`owner`。
- 调用 `entry project init --dry-run --json`，把计划给用户确认。
- 调用 CLI 执行，并用返回 JSON 汇总中文结果。

Skill 不应该手工创建目录、patch Markdown、直接读 JSONL 或复制 Git/GitHub 流程。

### Plugin / Extension

当前没有足够必要性把这个能力做成 Claude Code plugin 或 Pi extension。对应目录只保留调研结论和未来可能的分发边界；现在直接使用 CLI + skill 即可。

## 快速开始

```bash
pnpm install
pnpm check
pnpm test
pnpm cli project init demo-project --desc "用于验证 entry 初始化流程" --dry-run --json
```

构建后可使用二进制入口：

```bash
pnpm build
node dist/cli/index.js project init demo-project --desc "用于验证 entry 初始化流程" --dry-run --json
```

## 目录

```text
entry-init-project/
  src/
    domain/       # contract、错误、路径和渲染
    services/     # Effect Context/Layer：文件系统、shell、clock
    workflows/    # project init、activity、inbox、repo
    cli/          # entry CLI
  skills/         # 瘦身版 init-project skill
  adapters/       # 宿主交付调研；当前推荐直接用 CLI + skill
  .flue/          # Flue agent 薄适配壳
  templates/      # Hyper-Extract/graphify 派生模板
  docs/           # 中文设计资料
```

## 重要约束

`activity/events/**/*.jsonl` 是 append-only 事实源。Agent 不应直接读取这些原始日志；必须通过 `entry activity query`、`entry activity context` 或 `entry activity export` 获取裁剪后的上下文和派生物。

Markdown、FTS、graphify、Hyper-Extract 输出都是可删除、可重建的 derived artifacts，不能反向覆盖事实源。
