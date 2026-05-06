# init-project 能力：系统化思考

日期：2026-05-05

## 用户意图

为现有 `init-project` skill 建立一个专用仓库，把它从“长篇操作说明”演进为全局项目初始化能力。

关键观察是：当前 skill 让 agent 每次重新理解目录创建、Markdown 插入、Git 初始化、GitHub 仓库创建和项目索引维护。这些操作确定、重复、可测试，不应该长期停留在 prompt 里。

## 核心重构

这不是 prompt 写得不够好的问题，而是职责边界问题。

目标形态：

```text
瘦身 skill dispatcher -> 确定性 CLI 子命令 -> append-only 事实和派生视图
```

模型继续负责命名、意图识别、摘要、冲突解释和确认问题；CLI 负责目录、文件、Git、GitHub、Foyer event、索引和设备扫描。

## 分层

### 1. Skill 层

职责：

- 识别项目初始化请求。
- 收集或推断项目名、描述、lane、owner。
- 先调用 CLI dry-run。
- 只在远端发布、覆盖、secret、不可逆动作时确认。
- 返回中文摘要。

非职责：

- 读取完整 Markdown 索引。
- 手工决定插入位置。
- 每次重建 Git/GitHub 命令序列。

### 2. CLI 层

提供低上下文、稳定 JSON 输出的命令：

```bash
foyer project init <name> --desc <text> --dry-run --json
foyer project list --json
foyer project upsert-index <name> --desc <text> --json
foyer inbox append --project <name> --raw-file <path> --json
foyer activity query --project <name> --json
foyer activity context --project <name> --budget 6000 --format markdown
foyer activity export --scope project:<name> --target graphify-corpus
foyer repo devices --json
foyer repo status --all --json
```

CLI 拥有结构化解析和 mutation。Markdown 保留为人类视图，但不是唯一数据库。

### 3. 状态层

事实使用 append-only JSONL，视图由代码生成：

- project registry
- activity events
- device registry
- repo clone manifest
- sync frontier
- project index、daily inbox、timeline 等 Markdown 视图

原则是保留事实，不重写历史。多设备冲突应生成可解释的 merge note，而不是丢弃其中一边。

### 4. Agent Harness 层

Flue 用作可部署 agent harness 的参考，而不是替代 CLI。

Flue 层接收自然语言 payload，用 LLM 提取结构化意图，然后调用同一个 CLI dry-run/execute。核心 workflow 不写进 prompt。

## 全局使用

能力应从任意目录运行。配置解析默认值：

```toml
projects_root = "~/repo/projects"
foyer_root = "~/.foyer"
github_visibility = "private"
device_name = "<hostname>"
```

环境变量可覆盖：

- `PROJECTS_ROOT`
- `FOYER_ROOT`
- `GITHUB_OWNER`
- `GITHUB_VISIBILITY`
- `DEVICE_NAME`

## 维护原则

不要继续膨胀 skill prose。每次发现重复操作，判断它属于：

- skill 文本：判断边界和确认策略。
- CLI 命令：确定性重复操作。
- reference doc：偶尔需要的背景。
- generated view：结构化事实的中文投影。

目标是持续降低 agent 上下文负担。
