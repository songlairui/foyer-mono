---
name: inbox
description: |
  项目内事项的轻量捕获、梳理、连接系统。三层：
  默认 (轻润色快闪捕获) / develop (对话梳理) / roadmap (建立连接)。
  触发：「inbox」「inbox xxx」「inbox roadmap」「丢一个想法」「梳理一下 inbox」「_inbox 那个」。
  仅管理项目根 _inbox/ 内文件，不与其他 skill 联动。
---

# Inbox Skill

## 工作目录

项目根的 `_inbox/`，子目录：`tapped/`, `developed/`, `roadmapped/`, `archive/`, `_roadmap/`。
不存在则按需创建。

## 命令分发

`inbox` 后第一个 token：

- 是 `develop|roadmap|list|show|archive|kill` → 走对应子命令
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
4. 抽 1-3 个 tag，**优先复用** `_inbox/**/*.md` 已出现过的 tag (需要通过 cli 指令获取top30 tag)
5. 润色 body：修口语/错字/表述方式（犹豫，试探，假设，直接抹掉，直接设定为是，直接讲意图）、保留全部原信息、**不添加原文未出现的概念或动机**
6. 在 body 末尾追加：

   ```
   <details>
     <summary>原文</summary>

   {原始输入}

   </details>
   ```

7. 写入 `_inbox/tapped/{id}-{type}-{slug}.md`，slug 从 title 派生
8. 返回单行：`✓ {id} · {type} · {title}`

**禁止**：反问用户、建议下一步、添加原文未出现的概念、把 idea 自动升级为 feat。

## `inbox develop [id]`

1. 无 id → 列 `tapped/` 让选
2. 读文件，回显当前 title + body 一行
3. 一次性问三项，允许写 `-` 跳过：
   - 起意：什么场景想到？
   - 类型 + 边界：feat/bug/chore/idea/question/decision，最小可交付？
   - 第一个动作：明天动手先做啥？
4. 综合提议结构化版本，等用户确认/修改
5. 写入 `_inbox/developed/{id}-{type}-{slug}.md`，删除 tapped 原文件
6. 不调其他 skill，不建议「下一步要不要 roadmap」

## `inbox roadmap [id]`

1. 无 id → 列 `developed/` 让选
2. 扫 `_inbox/{developed,roadmapped}/` 找候选邻接（tag 重叠 + title 关键词模糊匹配，≤5 个）
3. 读 `_inbox/_roadmap/*.md` 现有标题
4. 一次性输出：相关 items / 可能的 roadmap 归属 / 前置后继候选
5. 用户回应后：在选定 `_inbox/_roadmap/{topic}.md` 追加节点，目标 item frontmatter `related` 填邻接 id，移到 `roadmapped/`

## `inbox list [--tapped|--developed|--roadmapped]`

列 id + type + title，时间倒序。无参数三段都列。

## `inbox show <id>`

全文输出。id 前缀模糊匹配。

## `inbox archive <id>`

移到 `archive/{YYYY-MM}/`。

## `inbox kill <id>`

追问一次「为什么不做？一句话」，写入 `killed_reason`，移到 `archive/killed/{YYYY-MM}/`。

## 文件契约

frontmatter：

- `id`: 必填
- `title`: 默认 tap 起就必填（润色生成）
- `type`: 默认 tap 起就必填，枚举 `feat|bug|chore|idea|question|decision`
- `tags`: list，0-3 项
- `created`, `updated`: ISO 时间
- `related`: list of id（roadmap 后填）
- `killed_reason`: kill 时填

文件名：`{YYYYMMDD-HHMM}-{type}-{slug}.md`，slug 从 title 派生，保留中文。
title 推断质量低时 slug 退回 `untitled-{uuid4}`，提醒下游 develop 阶段补救。

## 不做什么

- 不调其他 skill
- 不在默认 tap 里追问
- 不在 develop / roadmap 后建议「下一步」
- 不修改 `archive/` 里的文件
- 不写入 `_inbox/` 之外的位置
