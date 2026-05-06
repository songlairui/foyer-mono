# Agent 交付形式矩阵：CLI、Skill、Code Agent Plugin、Flue Agent

调研日期：2026-05-05

## 结论

Flue 不是唯一交付形式，它更像“可部署 agent harness”的交付壳。对 `entry-init-project` 来说，正确形态不是从 skill 迁移到 Flue 后丢掉 skill，而是建立一个交付矩阵：

- CLI：确定性能力底座，给人、CI、各种 code agent 和未来 app 调用。
- Skill：最低摩擦的 agent 内复用形式；它本身也分为“泥石流版”和“瘦身版”两个阶段。
- Code Agent Plugin：宿主专用的增强包，用于分发 skill、命令、hooks、MCP/LSP、二进制工具或 Pi extension。
- Flue Agent：可部署、可 HTTP/CLI/CI 触发的 headless agent，用于把能力暴露成服务或自动化工作流。

这四种形式不是替代关系，而是同一个核心能力的不同入口。真正应该稳定下来的是 Effect 驱动的流程内核和 CLI/API contract。

## 交付矩阵

| 形式                   | 主要承载                                                                          | 运行位置                             | 是否复用宿主环境        | 最适合                                         | 主要风险                                  | 本项目产物                         |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------ | ----------------------- | ---------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| CLI                    | TypeScript/Effect 程序、命令、JSON schema、exit code                              | 用户本机、CI、agent shell            | 是                      | 确定性文件/Git/GitHub/Foyer 操作               | 若交互协议不稳定，agent 难以可靠调用      | `foyer project init` 等命令        |
| Skill                  | `SKILL.md`、引用文档、脚本、模板                                                  | code agent 的工作区或全局 skill 目录 | 是                      | 从 0 探索能力，或跨 agent 复用稳定入口         | 泥石流版上下文重；瘦身版依赖 CLI contract | 泥石流参考版 + 瘦身日常版          |
| Claude Code Plugin     | `.claude-plugin/plugin.json`、`skills/`、`agents/`、`hooks/`、`.mcp.json`、`bin/` | Claude Code 插件系统                 | 是                      | 团队分发、命名空间、hooks、MCP/LSP、可验证安装 | 绑定 Claude Code 生态                     | `entry-init-project` Claude plugin |
| Pi Package / Extension | npm/git package、`skills/`、`extensions/`、prompt templates、themes               | Pi coding agent                      | 是                      | Pi 用户的自定义命令、工具、事件拦截、UI        | extension 具备完整系统权限，需要审查      | `entry-init-project` Pi package    |
| Flue Agent             | `.flue/agents/*.ts`、roles、skills、sandbox、session                              | Node、Cloudflare、CI、HTTP 服务      | 可选，本地 sandbox 时是 | 自动化触发、HTTP endpoint、CI agent、服务化    | Flue API 仍在演进，adapter 不宜太厚       | `.flue/agents/project-init.ts`     |

## 共同架构

推荐把项目拆为“核心能力层”和“交付适配层”：

```text
entry-init-project/
  packages/
    cli/
      src/
        domain/             # 项目名、配置、事件、视图模型
        workflows/          # Effect 工作流
        services/           # FileSystem、Git、GitHub、EntryStore 等依赖接口
        cli/                # 命令行入口
  adapters/
    skills/
      init-project/
        SKILL.md
        references/
          mudslide-version.md
    claude-code-plugin/
      .claude-plugin/
        plugin.json
      skills/
      bin/
      hooks/
    pi-package/
      package.json
      skills/
      extensions/
    flue/
      .flue/
        agents/
        roles/
  docs/
    wiki/
```

核心原则：

- 领域规则只写一次：项目名校验、路径解析、entry append-only 规则、Git/GitHub 状态判断、失败恢复。
- 副作用通过 Effect 控制：配置、文件系统、shell、GitHub CLI、时间、设备名、日志、dry-run、重试和补偿动作。
- 所有交付形式调用同一套核心能力，不复制流程逻辑。
- LLM 只负责不可完全确定的判断：命名、描述润色、lane 推断、冲突解释、用户确认问题。

## CLI：AI 时代需要的底座

CLI 是这套系统最重要的底层交付形式。原因很朴素：所有 code agent 最稳定的共通能力都是读取文件、执行 shell、解析输出。

面向 AI 的 CLI 应该比传统人类 CLI 多一些约束：

- 默认支持 `--json`，输出稳定 schema，方便 agent 和 CI 解析。
- 支持 `--dry-run`，先返回执行计划，不产生副作用。
- 支持幂等和恢复，例如检测目录已存在、远端 repo 已存在、entry 事件已写入。
- 明确 exit code：输入错误、外部依赖缺失、权限失败、网络失败、部分成功分别可区分。
- stdout 给机器，stderr 给人类诊断。不要把彩色进度条和 JSON 混在一起。
- 所有危险动作显式化：创建远端 repo、push、覆盖视图、修复冲突都需要参数或确认。
- 每一步产生日志事件，最终可以写入 `activity/events/...jsonl`。

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
```

CLI 不应该假设调用者是人类。它可以有人类友好的摘要，但机器协议必须是一等公民。

## Skill：保留，且作为跨 agent 的最低共同形式

Skill 应继续保留。Agent Skills 的通用格式是一个目录加 `SKILL.md`，其中 frontmatter 至少包含 `name` 和 `description`，并可携带脚本、引用文档、模板和资源。Agent 通过 progressive disclosure 工作：启动时只看名称和描述，任务匹配后再读完整说明，必要时再读取引用文件或执行脚本。

这里需要区分两类 skill，它们对应一个能力从 0 到稳定的不同阶段。

### 泥石流版 Skill

泥石流版 skill 通常出现在能力最初构建时。它会把大量上下文、操作步骤、边界情况、失败恢复、示例和临时判断都写进 `SKILL.md` 或其引用文件里。它的目标不是轻，而是先把事情做成，并在多次真实执行中暴露需求。

泥石流版的价值：

- 从 0 增加底层能力时，可以作为操作剧本和示范样本。
- 在 CLI 还不存在、能力边界还没稳定时，让 agent 先能完成目标。
- 记录当时为什么要处理某些特殊情况，避免后续瘦身时丢掉隐性经验。
- 给未来抽取 CLI、Effect workflow、测试用例和错误模型提供材料。

泥石流版的代价：

- 每次触发都需要 LLM 读取和处理较多流程细节。
- 同一流程容易被不同 agent 解释出细节差异。
- 维护频率会在瘦身版出现后显著降低。

因此泥石流版应该被保留，但不应该长期作为日常入口。推荐把它放在 `references/mudslide-version.md`、`archive/`，或使用一个不容易被自动触发的 skill 名称，例如 `init-project-manual`。它主要用于回看、演示、迁移和补足 CLI 未覆盖的新场景。

### 瘦身版 Skill

瘦身版 skill 出现在底层能力已经被 CLI/Effect workflow 承接之后。它不再复述所有文件操作，而是变成：

```text
skill = CLI 调用方法 + 常规用法说明 + 判断边界 + CLI help 兜底
```

瘦身版的目标是让 agent 用最少上下文稳定完成任务。它应该告诉 agent：

- `description` 用于让宿主 agent 自动识别“创建项目/初始化 repo/登记 entry”请求。
- `SKILL.md` 只描述判断边界和调用 CLI 的方式，不再手写所有文件操作。
- `references/` 放 Foyer/entry 协议、失败恢复、命名规范、示例输出。
- `scripts/` 可以保留最薄的兼容脚本，但确定性主逻辑应下沉到 CLI。
- 如果 CLI 返回未知错误或参数不清楚，优先读取 `foyer project init --help` 或对应子命令 help，而不是猜测实现细节。

推荐瘦身版 skill 职责：

```text
1. 判断用户是否在请求初始化项目。
2. 提取或生成项目名、描述、lane、owner。
3. 如涉及远端发布、覆盖、secret、不可逆操作，先向用户确认。
4. 调用 CLI 的 dry-run，读取结构化计划。
5. 如 CLI 参数或错误不清楚，读取 CLI help 兜底。
6. 调用 CLI 执行，返回中文摘要。
```

### 两种 Skill 如何共存

在一个项目的迭代进化过程中，两种 skill 可能都需要存在：

| 类型     | 生命周期位置                  | 日常触发         | 维护频率                 | 主要用途                     |
| -------- | ----------------------------- | ---------------- | ------------------------ | ---------------------------- |
| 泥石流版 | 能力从 0 到 1、CLI 尚未稳定时 | 低，最好显式触发 | 瘦身版出现后极低         | 参考、演示、迁移、补充新边界 |
| 瘦身版   | CLI/Effect workflow 稳定后    | 高，默认入口     | 随 CLI contract 同步更新 | 日常执行、跨宿主复用         |

推荐目录：

```text
skills/
  init-project/
    SKILL.md                  # 瘦身版，默认入口
    references/
      mudslide-version.md     # 泥石流参考版，低频维护
      cli-contract.md
      examples.md
```

如果某段流程在泥石流版中反复出现，就说明它正在成熟，应该被抽取到 CLI/Effect 层。抽取完成后，瘦身版 skill 只保留调用方式和判断边界；泥石流版保留为历史样本和异常情况参考。

Skill 的边界也要清楚：它是“指导宿主 agent 如何使用能力”，不是强约束执行环境。安全、幂等和恢复必须在 CLI/Effect 层兜住。

## Code Agent Plugin：宿主专用分发壳

### Claude Code Plugin

Claude Code plugin 是更强的分发单位。官方文档把它描述为可包含 skills、agents、hooks、MCP servers、LSP servers、background monitors 和 `bin/` 可执行文件的目录；插件根目录有 `.claude-plugin/plugin.json` 描述身份、版本和元数据。

适合本项目的 Claude plugin 结构：

```text
entry-init-project-plugin/
  .claude-plugin/
    plugin.json
  skills/
    init-project/
      SKILL.md
      references/
  agents/
    project-planner.md
  hooks/
    hooks.json
  bin/
    entry-project-init
  settings.json
```

Claude plugin 应该提供：

- 一个 namespaced skill，例如 `/entry-init-project:init-project`。
- 可选 custom agent，用于更重的规划或迁移分析。
- `bin/` 中的 CLI shim，让 Claude Code 在插件启用时能直接调用。
- 可选 hook，例如在执行前检查 `.env`、`~/.entry/config.toml` 或 GitHub CLI 登录状态。

Claude plugin 的价值在于分发和宿主集成，不在于复制业务逻辑。Plugin 里的 skill 仍应调用同一个 CLI。

### Pi Package / Extension

Pi 官方更常用 “package / extension / skill / prompt template / theme” 这些词，而不是 Claude Code 那种 `plugin.json` 模型。生态里常把它叫 Pi plugin，但实现上应该按 Pi package 来做。

Pi 的关键能力：

- skills：同样是 `SKILL.md`，并支持 `/skill:name` 命令。
- extensions：TypeScript 模块，可以注册工具、命令、快捷键、事件处理器、UI、上下文注入和自定义 provider。
- packages：把 extensions、skills、prompt templates 和 themes 打包，通过 npm、git 或本地路径安装。
- SDK/RPC：可以把 Pi 嵌入其他程序，或通过 JSONL 协议做 headless 集成。

适合本项目的 Pi package 结构：

```text
entry-init-project-pi/
  package.json
  skills/
    init-project/
      SKILL.md
      references/
  extensions/
    entry-init-project.ts
```

Pi extension 可以做三类增强：

- 注册 `/entry-project-init` 命令，调用 CLI 或 dry-run。
- 拦截危险 shell/tool call，例如阻止未确认的远端 repo 创建或 push。
- 注入动态上下文，例如当前 foyer root、projects root、device name、GitHub 登录状态。

Pi 文档提醒 extensions 以完整系统权限运行，packages 中的 skills 也可能指示模型执行任意动作。因此 Pi package 必须默认可读、可审查、可 dry-run，并把真实副作用放在 CLI/Effect 层校验。

## Flue Agent：服务化和自动化交付

Flue 的定位是 agent harness framework。它把 agent 建模为 model + harness，支持 skills、memory、sessions、filesystem/sandbox，并能通过 CLI、HTTP endpoint 或部署目标运行。

Flue 对本项目的价值：

- 让项目初始化能力脱离某个聊天会话，以 headless agent 形式运行。
- 可以用 `flue run` 做 CI 或本地一次性触发。
- 可以用 Node HTTP endpoint 暴露给其他 app。
- 可以用 local sandbox 复用本机仓库和 `~/.foyer`，也可以在未来切到隔离 sandbox。
- 能用结构化 schema 接收 LLM 结果，把判断和确定性执行拆开。

Flue 不应该成为唯一入口。它应作为一个 adapter：

```text
payload -> Flue agent -> LLM 提取意图 -> Effect dry-run -> 必要确认 -> Effect execute -> 中文结构化结果
```

早期建议保持 Flue 层很薄，因为 Flue 仍在快速演进。核心 workflow 不应写死在 `.flue/agents/project-init.ts` 中。

## 推荐落地顺序

1. 定义核心 contract：`ProjectInitRequest`、`ProjectInitPlan`、`ProjectInitResult`、错误类型、事件类型。
2. 实现 Effect workflow 和 CLI dry-run，让任何 agent 都能先看计划。
3. 整理现有泥石流版 skill：保留为参考/演示材料，抽取重复流程、边界情况和失败样本。
4. 创建瘦身版 skill：保留 `SKILL.md` 形式，但日常入口只说明判断边界、CLI 用法和 help 兜底。
5. 打包 Claude Code plugin：把瘦身版 skill、泥石流参考材料、CLI shim、可选 hook 和 manifest 放进去。
6. 打包 Pi package：提供同名瘦身 skill，加一个小 extension 做命令和安全检查。
7. 创建 Flue agent：用 Node/local sandbox 起步，调用同一 workflow。
8. 做兼容性测试：同一输入从 CLI、skill、Claude plugin、Pi package、Flue agent 触发，产出同构 plan/result。

## 判断规则

当一个能力不知道放在哪一层时，按下面规则决策：

| 问题                                                      | 放置位置               |
| --------------------------------------------------------- | ---------------------- |
| 需要严格幂等、可测试、可恢复吗                            | Effect workflow        |
| 需要被任何 agent 或 CI 调用吗                             | CLI                    |
| 能力还在从 0 探索，尚未沉淀成 CLI 吗                      | 泥石流版 Skill         |
| 只是告诉 agent 什么时候以及如何调用稳定能力吗             | 瘦身版 Skill           |
| 需要宿主专用安装、命名空间、hooks、MCP、LSP、bin 注入吗   | Claude Code Plugin     |
| 需要 Pi 的命令、事件拦截、UI 或自定义工具吗               | Pi Extension / Package |
| 需要 HTTP endpoint、CI agent、持久 session 或服务化部署吗 | Flue Agent             |

## 对 `entry-init-project` 的当前建议

短期不要把 `GOAL.md` 中的 Flue 目标撤销，而是把它降级为矩阵中的一个交付形式。新的项目目标应表达为：

```text
以 Effect/CLI 为核心能力底座；
以 Skill 保持跨 code agent 的直接可用性，其中泥石流版保存能力生长经验，瘦身版作为默认日常入口；
以 Claude Code plugin 和 Pi package 提供宿主级分发；
以 Flue agent 提供服务化、CI 和 HTTP 触发能力。
```

这能同时满足两个方向：继续复用宿主环境，也保留未来把能力部署为 agent 服务的路径。

## 参考资料

- [Agent Skills Overview](https://agentskills.io/)：Agent Skills 是开放格式，核心是 `SKILL.md` 加可选脚本、引用材料和资源，并通过 progressive disclosure 加载。
- [Claude Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)：Anthropic 对 skill 的加载层级、脚本执行和 token 成本模型说明。
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)：Claude Code plugin 的创建、目录结构、skills、agents、hooks、MCP/LSP 和 `bin/` 分发方式。
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)：插件命令、路径变量、校验和调试方式。
- [Pi Documentation](https://pi.dev/docs/latest)：Pi 的总体扩展模型，包括 extensions、skills、prompt templates、themes、packages、SDK 和 RPC。
- [Pi Extensions](https://pi.dev/docs/latest/extensions)：Pi extension 的 TypeScript API、事件、命令、工具、UI 和安全提示。
- [Pi Skills](https://pi.dev/docs/latest/skills)：Pi 对 Agent Skills 标准的支持、`/skill:name` 命令和 frontmatter 规则。
- [Pi Packages](https://pi.dev/docs/latest/packages)：Pi package 如何通过 npm、git、本地路径分发 extensions、skills、prompts 和 themes。
- [Flue](https://flueframework.com/)：Flue 的 agent harness 定位、CLI/HTTP 触发方式、sandbox/filesystem/session 模型。
- [Flue Node Deploy Guide](https://raw.githubusercontent.com/withastro/flue/refs/heads/main/docs/deploy-node.md)：Node 本地 sandbox、`flue run`、HTTP endpoint 和部署方式。
- [Effect Documentation](https://effect.website/docs/getting-started/introduction/)：Effect 在 TypeScript 中提供并发、错误处理、资源安全、可组合性和可观测性，适合作为流程控制底座。
