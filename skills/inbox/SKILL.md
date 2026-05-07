---
name: inbox
description: |
  项目内事项的轻量捕获、梳理、实施、审查、完成系统。
  状态流：tapped → todo → in-progress → in-review → done。
  触发：「inbox」「inbox xxx」「inbox process」「inbox start」「inbox review」「inbox done」
  「丢一个想法」「梳理一下 inbox」「批量梳理 tapped」「_inbox 那个」。
  仅管理项目根 _inbox/ 内文件，不与其他 skill 联动。
---

# Inbox Skill

## 工作目录

项目根的 `_inbox/`，子目录：`tapped/`, `todo/`, `in-progress/`, `in-review/`, `done/`, `archive/`, `_roadmap/`。
不存在则按需创建。

状态流转：

```
tapped → todo → in-progress → in-review → done
                in-progress ↔ blocked
```

与 multica 状态对齐：tapped = Backlog，todo = Todo，in-progress = In Progress，in-review = In Review，done = Done，blocked = Blocked。

## 命令分发

`inbox` 后第一个 token：

- 是 `develop|process|start|review|done|block|unblock|roadmap|list|show|archive|kill` → 走对应子命令
- 是 `tap` → 把后续作为内容走默认 tap（向后兼容）
- **其他任何情况 → 把整串作为内容走默认 tap**

单独 `inbox` = `inbox list`。

## 默认 (tap) 行为

**用户那边零对话；Agent 内部全自动处理。**

收到内容后：

1. 生成 id：`{YYYYMMDD-HHMM}`
2. 推断 title（8-15 字名词短语，不用"想/要/做"起手）
3. 推断 type，启发式如下：
   - 「想加/增加/支持」→ feat
   - 「崩了/不对/报错」→ bug
   - 「重构/整理」→ chore
   - 「也许/不知道」→ idea
   - 「？/还是/应该选」→ question
   - 「决定/定了」→ decision
   - 不像 → idea
4. 抽 1-3 个 tag，**优先复用** `_inbox/**/*.md` 已出现过的 tag（需通过 cli 指令获取 top30 tag）
5. 润色 body：修口语/错字/表述方式（犹豫，试探，假设，直接抹掉，直接设定为是，直接讲意图）、保留全部原信息、**不添加原文未出现的概念或动机**
6. 在 body 末尾追加：

   ```
   <details>
     <summary>原文</summary>

   {原始输入}

   </details>
   ```

7. 写入 `_inbox/tapped/{id}-{type}-{slug}.md`，frontmatter 含 `status: tapped`
8. 返回单行：`✓ {id} · {type} · {title}`

**禁止**：反问用户、建议下一步、添加原文未出现的概念、把 idea 自动升级为 feat。

## `inbox develop [id]`（单条交互式梳理）

1. 无 id → 列 `tapped/` 让选
2. 读文件，回显当前 title + body 一行
3. 一次性问三项，允许写 `-` 跳过：
   - 起意：什么场景想到？
   - 类型 + 边界：feat/bug/chore/idea/question/decision，最小可交付？
   - 第一个动作：明天动手先做啥？
4. 综合提议结构化版本，等用户确认/修改
5. 写入 `_inbox/todo/{id}-{6位哈希}-{type}-{slug}.md`，frontmatter 加 `status: todo`，删除 tapped 原文件
6. 不调其他 skill，不建议「下一步要不要 start」

## `inbox process [--all|<id>...]`（批量 agent 设计）

对 tapped/ 中的条目批量做设计梳理，产出 todo/ 设计稿。

**清晰度评估**（决定是直接写入还是追问）：

- **信息充足**：tap 内容明确了做什么、边界清晰、无重大架构分歧 → 直接产出设计稿写入 `todo/`
- **信息不足**：类型模糊、设计方向有多种可能、关键前提未明 → 先追问，用户补充后再写入 `todo/`
- `--auto-start` flag：清晰的条目直接进 `in-progress/`（跳过 todo）

每条 tap 的两阶段分析：

1. **Planner**：读 tap 全文 + 仓库相关现有实现（检查 `packages/cli/src/workflows/`、`skills/` 已有能力），产出「## 起意 / ## 决定 / ## TODO / ## 待用户确认」设计稿
2. **Critic**：审查——边界是否清晰、是否重复已有实现、命名是否一致、数据契约是否完整；把未决问题收入「待用户确认」章节

产出写入 `_inbox/todo/{id}-{6位哈希}-{type}-{slug}.md`，frontmatter 含 `status: todo`，删除 tapped 原文件。

**禁止**：跳过 Critic 阶段、在设计稿里实现 TODO（design only）、process 完成后建议下一步。

## `inbox start <id>`（todo → in-progress）

确认要动手，进入实施。

1. id 模糊匹配 `todo/` 中的文件
2. mv `todo/{...}.md` → `in-progress/{...}.md`
3. frontmatter：`status: in-progress`，追加 `started: {ISO now}`
4. 单行回执：`✓ {id} → in-progress`
5. **不改动正文**，不建议下一步

## `inbox review <id>`（in-progress → in-review）

实施完成，进入审查。

1. id 模糊匹配 `in-progress/` 中的文件
2. mv `in-progress/{...}.md` → `in-review/{...}.md`
3. frontmatter：`status: in-review`，追加 `reviewed_at: {ISO now}`
4. 单行回执：`✓ {id} → in-review`
5. **不改动正文**

## `inbox done <id>`（in-review → done）

审查通过，标记完成。

1. id 模糊匹配 `in-review/` 中的文件（也接受 `in-progress/` 直接跳过 review）
2. mv → `done/{...}.md`
3. frontmatter：`status: done`，追加 `completed: {ISO now}`
4. 单行回执：`✓ {id} → done`
5. **不改动正文**

## `inbox block <id>` / `inbox unblock <id>`

1. `block`：id 匹配 `in-progress/`，追问「什么阻塞了？一句话」，写入 `blocked_reason`，frontmatter `status: blocked`，mv 到 `in-progress/`（保持在同目录，状态字段区分）
2. `unblock`：id 匹配 status=blocked 的文件，清除 `blocked_reason`，frontmatter `status: in-progress`
3. 两者均不改动正文，不建议下一步

## `inbox roadmap [id]`

1. 无 id → 列 `todo/` 让选
2. 扫 `_inbox/{todo,roadmapped}/` 找候选邻接（tag 重叠 + title 关键词模糊匹配，≤5 个）
3. 读 `_inbox/_roadmap/*.md` 现有标题
4. 一次性输出：相关 items / 可能的 roadmap 归属 / 前置后继候选
5. 用户回应后：在选定 `_inbox/_roadmap/{topic}.md` 追加节点，目标 item frontmatter `related` 填邻接 id，移到 `roadmapped/`

## `inbox list [--tapped|--todo|--in-progress|--in-review|--done|--roadmapped]`

列 id + type + title，时间倒序。无参数列 tapped / todo / in-progress 三段（不列 done）。

## `inbox show <id>`

全文输出。id 前缀模糊匹配，跨所有状态目录搜索。

## `inbox archive <id>`

任意状态均可触发。移到 `archive/{YYYY-MM}/`，frontmatter `status: archived`。

## `inbox kill <id>`

任意状态均可触发。追问一次「为什么不做？一句话」，写入 `killed_reason`，frontmatter `status: killed`，移到 `archive/killed/{YYYY-MM}/`。

## 文件契约

frontmatter：

- `id`: 必填；develop/process 后加 6 位哈希后缀（如 `20260507-1019-ff5ec4`）
- `title`: 必填
- `type`: 必填，枚举 `feat|bug|chore|idea|question|decision`
- `tags`: list，0-3 项
- `created`, `updated`: ISO 时间
- `status`: 当前状态，枚举 `tapped|todo|in-progress|in-review|done|blocked|archived|killed`
- `source`: 跨项目投递来源（如 `md-reader`），本地 tap 不填
- `related`: list of id（roadmap 后填）
- `started`: ISO 时间，start 时填
- `reviewed_at`: ISO 时间，review 时填
- `completed`: ISO 时间，done 时填
- `blocked_reason`: block 时填
- `killed_reason`: kill 时填

文件名：`{YYYYMMDD-HHMM}-{type}-{slug}.md`（tap 阶段）；develop/process 后变为 `{YYYYMMDD-HHMM}-{6位哈希}-{type}-{slug}.md`。

## 不做什么

- 不调其他 skill
- 不在默认 tap 里追问
- 不在各子命令后建议「下一步」
- 不在 start / review / done 时改动正文
- 不修改 `archive/` 里的文件
- 不写入 `_inbox/` 之外的位置
- 不在 process 里跳过 Critic 阶段
- 不把 idea 自动升级为 feat

（改完后运行 `./sync-skills.sh` 把变更同步到 `~/.claude/skills/inbox/`。）
