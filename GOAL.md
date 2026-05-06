# GOAL: 将 `init-project` 能力产品化为多交付形式系统

## 项目目标

把当前以 prose skill 形式存在的 `init-project` 能力，演进为一个以 Effect/CLI 为核心、同时支持 Skill、Code Agent Plugin、Pi Package/Extension、Flue Agent 的多交付形式系统。

最终效果不是“把原来的 `SKILL.md` 改写得更长”，也不是“把 skill 替换成 Flue”。真正目标是把重复、确定、可审计的流程下沉到代码和 CLI，把 LLM 保留在命名、意图澄清、摘要、冲突解释和不可完全确定的判断点上。不同宿主只负责交付和触发同一套能力。

系统应该能稳定创建项目、记录过程、更新 `~/.foyer` 的 append-only 事实，并提供低上下文查询、投影导出和派生抽取接口。`jsonl` 是事实源；Markdown 视图、全文索引、graphify 图谱和 Hyper-Extract Knowledge Abstract 都是可重建的 derived artifacts。

## 背景判断

现有 `init-project` skill 已经证明了场景真实存在：用户只要说出项目意图，系统就能创建本地 repo、GitHub 私有仓库、README、kickoff 目录，并把过程记录回 `~/.foyer`。

当前问题主要不是 prompt 不够好，而是流程职责放错了位置。每次执行都让模型重新理解 Markdown 插入、目录创建、Git 命令、GitHub 命令和 activity 记录，会带来三个成本：

- 稳定性成本：同一流程在不同 agent/run 中可能生成细节差异。
- 上下文成本：模型需要反复读取和重建本可由代码完成的操作。
- 审计成本：失败点和中间状态缺少统一的结构化记录。

因此，本项目的目标是把重复流程降到代码层，把判断和解释留给 LLM。

## 合理性与科学性审阅

这个方向是合理的：`entry` 协议强调原始记录 append-only、摘要作为派生视图、跨设备保留事实而不是重写历史；这天然适合用确定性命令和事件日志承载，而不是依赖模型每次手工 patch Markdown。

这个方向也足够“科学”，前提是后续实现必须可测量、可复现、可失败恢复。每一个架构假设都应对应验证方式：

- 假设：代码化流程比 prose skill 更稳定。
  验证：同一输入重复运行多次，比较输出目录、Foyer 事件、Markdown 视图和 Git 状态是否一致。
- 假设：LLM 只处理判断点会降低上下文负担。
  验证：记录每次运行读取的上下文文件数、模型调用次数、人工澄清次数和总耗时。
- 假设：append-only 事件比直接编辑 Markdown 更适合跨设备。
  验证：构造双设备同时创建/更新同一项目的冲突案例，确认事实保留、视图可解释、需要用户确认的冲突被显式标记。
- 假设：多交付形式比单一 Flue agent 更适合这个能力。
  验证：同一输入可以通过 CLI、瘦身版 Skill、Claude Code plugin、Pi package 和 Flue agent 触发，并产出同构 plan/result。
- 假设：`jsonl` 事实层 + 派生抽取层比直接把存档改成图谱格式更稳。
  验证：graphify、Hyper-Extract、FTS 派生物可删除重建；重建后仍能追溯到相同 event id、raw_ref 和 source file。

需要警惕的一点是：Flue、graphify、Hyper-Extract 都应作为 adapter 或派生层，而不是绑定核心事实模型。早期实现要把宿主适配层做薄，核心领域逻辑放在独立 TypeScript/Effect 模块中，避免被任何一个外部工具的 API 或输出格式锁死。

## 核心交付

### 1. Effect 工作流控制层

过程控制优先使用 Effect（effect.ts）。Effect 层负责把初始化流程建模为可组合、可观测、可重试、可测试的程序。

Effect 层应覆盖：

- 配置解析：`projects_root`、`foyer_root`、`github_owner`、默认可见性、设备名。
- 输入校验：项目名、描述、lane、owner、路径安全性。
- 资源控制：临时文件、目录创建、Git 仓库、GitHub 调用、回滚/补偿动作。
- 结构化错误：目录已存在、`gh` 未登录、远端 repo 已存在、网络失败、Foyer 写入冲突。
- 事件记录：每一步产生 machine-readable event，供恢复、审计和 materialized view 使用。
- 并发边界：跨设备扫描、repo status、manifest 合并可以并发；项目创建主流程保持顺序和幂等。

Effect 不应只是包一层 Promise。它应成为流程状态、错误类型、依赖注入、日志和测试替身的核心骨架。

### 2. AI 友好的 CLI

CLI 是所有交付形式共享的稳定边界。它既给人类使用，也给 code agent、CI、Flue agent、Claude plugin、Pi extension 调用。

候选命令：

```bash
foyer project init <slug> --desc <text> --json
foyer project init <slug> --desc <text> --dry-run --json
foyer project plan --input request.json --json
foyer project list --json
foyer inbox append --project <slug> --raw-file <path> --json
foyer project upsert-index <slug> --json
foyer activity append --event project.created --project <slug> --json
foyer repo devices --json
foyer repo status --all --json
foyer activity query --project <slug> --json
foyer activity context --project <slug> --budget 6000 --format markdown
foyer activity export --scope project:<slug> --target graphify-corpus
foyer activity export --scope project:<slug> --target hyperextract-input
```

CLI 必须支持稳定 JSON 输出、`--dry-run`、幂等检查、明确 exit code、可恢复错误、帮助文本兜底和中文人类摘要。

### 3. Skill 交付形式

Skill 继续保留，且作为跨 code agent 的最低共同形式。它分为两个阶段：

- 泥石流版：保留旧 `init-project` prose skill 的完整操作经验，作为参考、演示、迁移材料和新边界发现工具。
- 瘦身版：默认入口，只描述何时使用、如何收集意图、如何调用 CLI、何时确认、如何读取 CLI help 兜底。

推荐目录：

```text
skills/
  init-project/
    SKILL.md                  # 瘦身版，默认入口
    references/
      mudslide-version.md     # 泥石流参考版
      cli-contract.md
      examples.md
```

Skill 不再手工重建文件/Git/GitHub/Foyer 过程。只要某段流程在泥石流版中反复出现，就应被抽取到 CLI/Effect 层。

### 4. Code Agent Plugin / Package

需要提供宿主专用分发壳，但不复制业务逻辑：

- Claude Code plugin：`.claude-plugin/plugin.json`、`skills/`、`agents/`、`hooks/`、`.mcp.json`、`.lsp.json`、`bin/` 和 `settings.json`。
- Pi package/extension：`package.json`、`skills/`、`extensions/`、prompt templates；Pi extension 可注册命令、工具、事件拦截、UI 和动态上下文。

这些分发壳的主要价值是安装、命名空间、hooks、安全检查、宿主 UI 和路径注入。它们都应调用同一 CLI/Effect workflow。

### 5. Flue Agent

Flue agent 保留为服务化和自动化交付形式，而不是唯一目标。

在当前非空仓库中使用 `.flue` 布局：

```text
.flue/
  agents/
    project-init.ts
  roles/
    project-planner.md
```

初始部署目标建议选择 Node.js，因为项目初始化需要访问本机文件系统、`git`、`gh`、`~/repo/projects` 和 `~/.foyer`。Flue 的 local sandbox 与受控 command grant 机制适合这个单用户、本机自动化场景。

Flue agent 的职责：

- 接收自然语言 payload。
- 用 LLM 提取结构化意图：项目名、描述、lane、owner、需要确认的问题。
- 调用 CLI dry-run 获取执行计划。
- 必要时请求确认。
- 调用 CLI/Effect 执行。
- 返回中文结构化结果。

### 6. Entry 存档、视图与派生抽取层

`~/.foyer` 作为事实与视图的承载位置，应减少模型直接手工编辑。

事实层继续使用 append-only JSONL：

```text
activity/events/<device>/<YYYY>/<MM>/<DD>.jsonl
activity/nodes/<hash>.json
activity/frontier/<device>.json
activity/manifests/<device>.json
```

人类可读视图由代码生成或更新：

```text
inbox/YYYY/MM/YYYY-MM-DD.md
projects/index.md
projects/<slug>.md
activity/views/
```

派生抽取层可删除、可重建：

```text
activity/derived/
  cursors/
  text/
  fts/
  graphify/
  hyperextract/
```

原则：

- `jsonl` 保存“发生了什么”，是 canonical source of truth。
- 大模型不直接读取原始 `activity/events/**/*.jsonl`。
- CLI 提供查询、上下文裁剪和投影导出。
- FTS 负责精确搜索和原文引用。
- graphify 负责跨文件/跨项目图谱导航，读取导出的 Markdown corpus。
- Hyper-Extract 负责强类型项目历史、决策、冲突和拓扑抽取，读取导出的 Markdown input 或 fragment。
- graphify/Hyper-Extract 输出不能直接回写为事实，只能作为 derived artifact 或待确认建议。

### 7. 共享项目结构

```text
entry-init-project/
  packages/
    cli/
      src/
        domain/
        workflows/
        services/
        cli/
  adapters/
    skills/
    claude-code-plugin/
    pi-package/
    flue/
  templates/
    entry/
      project_timeline.yaml
      decision_graph.yaml
      conflict_case.yaml
      delivery_matrix.yaml
      device_repo_topology.yaml
  docs/
    wiki/
```

## 非目标

- 不在第一阶段重写整个 `entry` 系统。
- 不在第一阶段实现完整跨设备 dashboard。
- 不在第一阶段实现完整 graphify/Hyper-Extract 深度集成，只建立投影和 adapter 边界。
- 不删除 skill 形式，也不把 Flue 作为唯一交付形式。
- 不让 LLM 直接持有 GitHub token、API key 或本地 secret。
- 不把 Markdown 当作唯一数据库。
- 不把 graphify 的 `graph.json` 或 Hyper-Extract 的 `data.json` 当作事实源。
- 不为了使用 Flue 而把确定性逻辑塞进 prompt。

## 未来 TODO

- 增加 Web 控制台，用于手动操作和把相近项目分组。
- 设计关联的远程 repo 支持：GitHub 当前已有；未来支持记录/配置私有部署地址的 GitLab 和 Gitea。

## 中文交付规范

从本文件开始，面向用户的项目文件默认使用中文交付，包括：

- README、GOAL、kickoff、设计文档、ADR。
- Flue role 和 skill 文档。
- Agent 返回给用户的摘要。
- 生成到 `~/.foyer` 的 inbox、project page 和 activity view。

代码标识符、包名、命令、schema 字段和外部协议名可以保留英文。

## 成功标准

第一阶段完成时，应能做到：

- 定义核心 contract：`ProjectInitRequest`、`ProjectInitPlan`、`ProjectInitResult`、错误类型和 activity event 类型。
- Effect workflow 能在 dry-run 模式下打印完整执行计划。
- CLI 支持 `foyer project init --dry-run --json`、`foyer project init --help` 和 `foyer project list`。
- 瘦身版 Skill 能调用 CLI dry-run，并在参数不清楚时读取 CLI help。
- 至少有一个 happy-path 测试和覆盖目录已存在、`gh` 不可用、数据根自动创建、项目列表的测试。
- 明确禁止 agent 直接读取 `activity/events/**/*.jsonl`，只通过 CLI 查询和导出。
- 所有用户可见文档和生成记录为中文。

第二阶段完成时，应能做到：

- 实际创建本地项目 repo。
- 初始化 Git 并生成第一提交。
- 可选创建 GitHub 私有仓库并 push。
- 追加 Foyer activity event。
- 更新或生成对应 Markdown 视图。
- 提供 `foyer activity query/context/export` 的最小实现。
- 提供 FTS 或等价本地搜索派生层，用于精确搜索和原文引用。
- 在失败后给出可恢复状态，而不是留下不可解释的半成品。

第三阶段完成时，应能做到：

- 支持 CLI、瘦身版 Skill、Claude Code plugin、Pi package/extension、Flue agent 五种交付入口。
- 支持 `flue run`、本地 Node HTTP endpoint 和 CLI 三种 Flue 触发方式。
- 支持跨设备 manifest/frontier 的最小扫描。
- 保留旧 `init-project` 泥石流版作为参考/演示材料，同时维护一个瘦身版默认入口：识别意图、调用 CLI/agent、读取 CLI help 兜底、汇报结果。
- graphify adapter 能导出 Markdown corpus 并运行 `graphify --update --wiki`。
- Hyper-Extract adapter 能用 `entry/project_timeline` 模板生成或增量更新 Knowledge Abstract。

## 参考资料

- 交付形式调研：`docs/wiki/agent-delivery-matrix.md`
- 存档层与抽取调研：`docs/wiki/archive-storage-and-extraction.md`
- Flue 创建 agent 起点：https://flueframework.com/start.md
- Flue README：https://raw.githubusercontent.com/withastro/flue/refs/heads/main/README.md
- Flue Node 部署指南：https://raw.githubusercontent.com/withastro/flue/refs/heads/main/docs/deploy-node.md
- Effect 文档入口：https://effect.website/docs/getting-started/introduction/
- 当前 skill 参考：`/Users/larysong/entry/.claude/skills/init-project/SKILL.md`
- Entry 默认承接协议：`/Users/larysong/entry/protocol/DEFAULT_ENTRY.md`
- Entry 跨设备同步协议：`/Users/larysong/entry/protocol/SYNC_BINOMIAL_FOREST.md`
