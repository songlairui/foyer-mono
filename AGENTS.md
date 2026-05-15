# Overview

foyer-mono 是一个将项目初始化流程收敛为可测试、可 dry-run、可多宿主调用的 TypeScript/Effect CLI 的 monorepo 项目。对外提供 `foyer` 命令，负责将项目安顿到本机项目空间和 `~/.foyer` 数据根中。

## Key Technologies

- **Monorepo Management**: Vite+ (with pnpm)
- **Language**: TypeScript
- **Effect System**: Effect-TS
- **Testing**: Vitest
- **CLI Framework**: Commander.js
- **Validation**: Zod

## Project Structure

```
foyer-mono/
  package.json              # 根 package.json，Vite+ 管理
  pnpm-workspace.yaml       # pnpm 工作区配置
  vite.config.ts            # Vite+ 配置
  packages/
    cli/                    # 核心 CLI 包
      src/
        domain/             # 合同、错误、路径和渲染
        services/           # Effect Context/Layer：文件系统、shell、clock
        workflows/          # 主要业务流程：project init、activity、inbox、repo
        cli/                # foyer CLI 入口
      tests/                # CLI workflow tests
  skills/                   # 瘦身版 init-project skill
  adapters/                 # 宿主交付调研
  .flue/                    # Flue agent 薄适配壳
  templates/                # Hyper-Extract/graphify 派生模板
  docs/                     # 中文设计资料
```

## Common Commands

### Installation & Setup

```bash
vp install                  # 安装所有依赖（通过 pnpm）
vp check                    # 运行类型检查
vp test                     # 运行所有测试
vp run build                # 构建整个项目
```

### CLI Development

```bash
pnpm cli --help             # 直接运行 CLI 源码
pnpm cli project init <slug> --desc <text> --dry-run --json  # 测试项目初始化
pnpm --dir packages/cli link --global  # 全局 link CLI
pnpm --dir packages/cli build  # 单独构建 CLI 包
```

### Web UI Development

```bash
pnpm dev:web                # 启动 web-ui 开发服务器
```

### Package Scripts

```bash
pnpm clean                  # 清理构建产物
pnpm build                  # 构建所有包
pnpm check                  # 运行类型检查
pnpm test                   # 运行所有测试
pnpm cli                    # 直接运行 CLI 源码
pnpm dev:web                # 启动 web-ui 开发服务器
pnpm flue:dev               # 启动 Flue 开发模式
pnpm flue:run               # 运行 Flue 项目初始化
```

## Key Workflows

### Project Initialization

主要工作流程位于 `packages/cli/src/workflows/project-init.ts`，包含：

- 创建本地项目结构
- 生成中文 README
- 创建 docs/kickoff/ 目录
- 执行 Git 首次提交
- 记录 activity event
- 生成 Markdown 视图

### Activity Management

通过 `foyer activity` 命令管理用户活动记录：

- 查询历史记录
- 导出上下文
- 生成索引

### Inbox Management

通过 `foyer inbox` 命令管理收件箱：

- 添加事项
- 列出事项
- 管理状态

## Development Rules

1. 使用 Vite+ 管理 monorepo 开发入口
2. 确定性流程放在 `packages/cli/src/workflows` 和 `packages/cli/src/cli`
3. 涉及 entry 历史数据的验证使用临时 `--entry-root`，不要直接改真实 `~/entry`
4. 不直接 patch `activity/events/**/*.jsonl`；新增写入路径必须走 CLI/workflow
5. 不提交 `dist/`、`.flue-dist/`、`node_modules/`、`.env*` 或本地 secret
6. 提交前至少运行 `vp check` 和 `vp test`；涉及 CLI 构建时运行 `vp run build`
7. 新增用户可见仓库文档默认使用中文；代码标识符、命令名、schema 字段可以保留英文

## Testing

- 测试文件位于 `packages/cli/tests/` 目录
- 使用 Vitest 作为测试框架
- 运行所有测试：`pnpm test`
- 单独运行某个测试文件：`pnpm test run <file-path>`

## Build & Release

```bash
# 构建
vp run build

# 发布到 npm（需先登录）
npm whoami
pnpm --dir packages/cli pack --dry-run
pnpm --dir packages/cli publish

# 本地调试
pnpm --dir packages/cli link --global
foyer --help
```

## Important Constraints

- `activity/events/**/*.jsonl` 是 append-only 事实源，不应直接读取
- 必须通过 `foyer activity query`、`foyer activity context` 或 `foyer activity export` 获取历史数据
- 不应该手工创建目录、patch Markdown、直接读 JSONL 或复制 Git/GitHub 流程

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Agent 开发规则

本仓库是开发，迭代，优化 `init-project` 技能的源仓库

已经将raw 节能的确定性流程下沉到 CLI/Effect 层。修改本仓库时遵守以下规则：

- 使用 Vite+ 管理 monorepo 开发入口；依赖安装仍通过 `vp install` 委托 pnpm。
- 确定性流程放在 `packages/cli/src/workflows` 和 `packages/cli/src/cli`，宿主 adapter 只做分发和调用。
- 涉及 entry 历史数据的验证使用临时 `--entry-root`，不要直接改真实 `~/entry`。
- 不直接 patch `activity/events/**/*.jsonl`；新增写入路径必须走 CLI/workflow。
- 不提交 `dist/`、`.flue-dist/`、`node_modules/`、`.env*` 或本地 secret。
- 提交前至少运行 `vp check` 和 `vp test`；涉及 CLI 构建时运行 `vp run build`。
- 新增用户可见仓库文档默认使用中文；代码标识符、命令名、schema 字段可以保留英文。
