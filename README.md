# entry-init-project

`entry-init-project` 把原本靠长篇 prose skill 执行的项目初始化流程，收敛成一个可测试、可 dry-run、可被多宿主调用的 TypeScript/Effect CLI。

对外命令名是 `foyer`。Foyer 的意象是“落户”：用户不需要操心新建文件夹、子文件夹、历史记录和索引应该放在哪里，只要描述要开始什么，CLI 负责把项目安顿到本机项目空间和 `~/.foyer` 数据根里。

本仓库现在是 pnpm monorepo。核心边界是 `packages/cli` 里的 `foyer` CLI；根目录的 docs、skills、adapters 和 `.flue/` 保持为全局资料与薄适配层，后续可以在 `packages/*` 或 `apps/*` 继续添加其他输出页面。

## 当前能力

- `foyer project init <slug> --desc <text> --dry-run --json` 输出完整执行计划。
- `foyer project init <slug> --desc <text>` 创建本地项目、中文 README、`docs/kickoff/`、Git 首次提交、activity event 和 Markdown 视图。
- `foyer project list` 列出已经通过 Foyer 落户/启动过的项目。
- `--github` 可选调用 `gh repo create` 创建远端仓库并 push。
- `foyer activity query/context/export` 提供低上下文查询、Markdown context、graphify/Hyper-Extract/本地搜索索引导出。
- `foyer inbox append`、`foyer project upsert-index`、`foyer repo devices/status/manifests`、`foyer doctor`、`foyer search` 覆盖最小 Foyer 辅助接口。

## 使用方式

推荐交付形态是 “npm 发布的 CLI + GitHub 发布的 skill”。Skill 只负责理解自然语言、确认计划和调用 `foyer`，所以安装 skill 前必须先确保本机能运行 `foyer` CLI。

### 安装 CLI

CLI 通过 npm 包分发。当前 `packages/cli/package.json` 的包名仍是 `entry-init-project`，二进制命令名是 `foyer`。发布到 npm 后，用户可以全局安装：

```bash
npm install -g entry-init-project
foyer --help
```

如果希望继续使用 `pnpm` 管理全局包，也可以：

```bash
pnpm add -g entry-init-project
foyer --help
```

发布包时先完成检查和构建：

```bash
pnpm install
pnpm check
pnpm test
pnpm build
npm whoami
pnpm --dir packages/cli pack --dry-run
pnpm --dir packages/cli publish --dry-run
pnpm --dir packages/cli publish
```

如果未来把包名改成 scoped package，例如 `@<scope>/entry-init-project`，首次公开发布时使用：

```bash
pnpm publish --access public
```

### 安装 Skill

Skill 默认随 GitHub 仓库发布，路径是 `skills/init-project/`。安装到 Codex 后，它会调用已经安装好的 `foyer` CLI：

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo <owner>/entry-init-project \
  --path skills/init-project
```

安装后重启 Codex，让新的 skill 生效。私有仓库可以继续使用本机已有的 GitHub 凭据，或在执行安装前配置 `GITHUB_TOKEN` / `GH_TOKEN`。

如果宿主不使用 Codex skill installer，也可以把 GitHub 仓库里的 `skills/init-project/` 复制到宿主约定的 skills 目录。不要复制 CLI/workflow 逻辑；skill 内只保留调用 `foyer` 的说明。

### 本地开发安装

本地调试 CLI 时，先安装依赖并构建，再把当前工作副本 link 成全局命令：

```bash
pnpm install
pnpm build
pnpm --dir packages/cli link --global
foyer --help
```

不想全局 link 时，可以直接跑源码入口：

```bash
pnpm cli --help
pnpm cli project init demo-project --desc "用于验证 Foyer 初始化流程" --dry-run --json
```

本地调试 skill 时，只在项目内创建符号链接，这样宿主如果扫描 `.agents/skills/*`，就能直接使用当前仓库维护的 skill，同时不用复制两份：

```bash
mkdir -p .agents/skills
ln -s ../../skills/init-project .agents/skills/init-project
```

如果目标目录已存在，先确认里面没有需要保留的本地修改，再删除或改名后重新链接。

### 运行 CLI

CLI 是稳定边界，适合人、agent、CI 和未来宿主 adapter 调用。初始化项目时先看计划：

```bash
foyer project init demo-project --desc "用于承接一个新项目的启动资料" --dry-run --json
```

确认计划后执行：

```bash
foyer project init demo-project --desc "用于承接一个新项目的启动资料" --json
```

需要创建 GitHub 仓库时显式开启远端动作：

```bash
foyer project init demo-project --desc "用于承接一个新项目的启动资料" --github --github-owner <owner> --json
```

列出已经落户过的项目：

```bash
foyer project list
foyer project list --json
```

查询历史记录时不要直接读取 `activity/events/**/*.jsonl`，通过 CLI 获取裁剪后的视图：

```bash
foyer activity query --project demo-project --json
foyer activity context --project demo-project --budget 6000 --format markdown
foyer search "启动资料" --project demo-project --json
```

只读 dashboard / doctor 用于列出当前数据面，不写入任何历史文件：

```bash
foyer doctor --json
foyer doctor --project demo-project --json
```

doctor 会汇总 Foyer 数据根、activity event、nodes/frontier/manifests、Markdown 视图、derived 文件、本地 repo 状态和 warnings。

### 使用 Skill

日常让 code agent 接管“新建项目目录组织的心理负担”时，优先使用 `skills/init-project/SKILL.md`。Skill 只做三件事：

- 理解自然语言意图，提取或生成 `slug`、`description`、`lane`、`owner`。
- 调用 `foyer project init --dry-run --json`，把计划给用户确认。
- 调用 CLI 执行，并用返回 JSON 汇总中文结果。

Skill 不应该手工创建目录、patch Markdown、直接读 JSONL 或复制 Git/GitHub 流程。

### Plugin / Extension

当前没有足够必要性把这个能力做成 Claude Code plugin 或 Pi extension。对应目录只保留调研结论和未来可能的分发边界；现在直接使用 CLI + skill 即可。

## 快速开始

```bash
pnpm install
pnpm check
pnpm test
pnpm cli project init demo-project --desc "用于验证 Foyer 初始化流程" --dry-run --json
```

构建后可使用二进制入口：

```bash
pnpm build
node packages/cli/dist/cli/index.js project init demo-project --desc "用于验证 Foyer 初始化流程" --dry-run --json
```

## 目录

```text
entry-init-project/
  package.json
  pnpm-workspace.yaml
  packages/
    cli/
      src/
        domain/       # contract、错误、路径和渲染
        services/     # Effect Context/Layer：文件系统、shell、clock
        workflows/    # project init、activity、inbox、repo
        cli/          # foyer CLI
      tests/          # CLI workflow tests
  skills/         # 瘦身版 init-project skill
  adapters/       # 宿主交付调研；当前推荐直接用 CLI + skill
  .flue/          # Flue agent 薄适配壳
  templates/      # Hyper-Extract/graphify 派生模板
  docs/           # 中文设计资料
```

## 重要约束

`activity/events/**/*.jsonl` 是 append-only 事实源。Agent 不应直接读取这些原始日志；必须通过 `foyer activity query`、`foyer activity context` 或 `foyer activity export` 获取裁剪后的上下文和派生物。

## 配置

默认配置：

```text
projects_root = "~/repo/projects"
foyer_root = "~/.foyer"
github_visibility = "private"
```

`FOYER_ROOT` 可以覆盖数据根。`--foyer-root <path>` 可用于测试或迁移；旧的 `ENTRY_ROOT` / `--entry-root` 仍作为兼容入口保留。

## Future TODO

- 增加 Web 控制台，用于手动操作和把相近项目分组。
- 设计远程 repo 支持：当前已有 GitHub；未来记录/支持私有部署地址的 GitLab 和 Gitea。

Markdown、FTS、graphify、Hyper-Extract 输出都是可删除、可重建的 derived artifacts，不能反向覆盖事实源。
