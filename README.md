# entry-init-project

`entry-init-project` 把原本靠长篇 prose skill 执行的项目初始化流程，收敛成一个可测试、可 dry-run、可被多宿主调用的 TypeScript/Effect CLI。

核心边界是 `entry` CLI。Skill、Code Agent Plugin、Pi Package/Extension 和 Flue Agent 都只负责识别意图、必要确认和调用 CLI，不复制业务流程。

## 当前能力

- `entry project init <slug> --desc <text> --dry-run --json` 输出完整执行计划。
- `entry project init <slug> --desc <text>` 创建本地项目、中文 README、`docs/kickoff/`、Git 首次提交、activity event 和 Markdown 视图。
- `--github` 可选调用 `gh repo create` 创建远端仓库并 push。
- `entry activity query/context/export` 提供低上下文查询、Markdown context、graphify/Hyper-Extract/本地搜索索引导出。
- `entry inbox append`、`entry project upsert-index`、`entry repo devices/status/manifests`、`entry search` 覆盖最小 entry 辅助接口。

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
  adapters/       # Claude Code plugin、Pi package、Flue 说明
  .flue/          # Flue agent 薄适配壳
  templates/      # Hyper-Extract/graphify 派生模板
  docs/           # 中文设计资料
```

## 重要约束

`activity/events/**/*.jsonl` 是 append-only 事实源。Agent 不应直接读取这些原始日志；必须通过 `entry activity query`、`entry activity context` 或 `entry activity export` 获取裁剪后的上下文和派生物。

Markdown、FTS、graphify、Hyper-Extract 输出都是可删除、可重建的 derived artifacts，不能反向覆盖事实源。
