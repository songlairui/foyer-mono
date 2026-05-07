---
name: inbox
description: |
  项目内事项的轻量捕获、梳理、连接系统。三层结构：
  tap (快闪零对话捕获) / develop (对话梳理 raw 想法) / roadmap (建立与其他事项的关系)。
  触发词：「inbox」「inbox tap」「inbox develop」「inbox roadmap」「丢一个想法」
  「梳理一下 inbox」「这件事在 roadmap 哪里」「_inbox 里那个」。
  仅管理项目根目录下 _inbox/ 内的文件，不与其他 skill 联动。
---

# Inbox Skill

## 工作目录

项目根的 `_inbox/`，子目录：`tapped/`, `developed/`, `roadmapped/`, `archive/`, `_roadmap/`。
不存在则按需创建。

## 命令分发

### `inbox tap <内容>`

**禁止任何反问。** 立即：

1. 生成 id：`{YYYYMMDD-HHMM}-{6位 uuid}`
2. 在 `_inbox/tapped/` 创建 `{id}.md`，frontmatter 最小集（id, created, updated, title=~, type=~），body = 用户原句
3. 返回单行：`✓ tapped {id}`
4. **结束**，不追加任何建议、提问、提示。

### `inbox develop [id]`

1. 若无 id：列出 `tapped/` 所有文件（id + 第一行 body），问用户选哪个或全部。
2. 读取目标文件，原样回显当前 body 一行。
3. 一次性提问三项（起意 / 类型+边界 / 第一动作），明确告知任何项可写 `-` 跳过。
4. 等用户回答。
5. 综合用户回答，**提议**结构化版本（含填好的 frontmatter 和分节 body）。
6. 用户确认或修改后：写入 `_inbox/developed/{id-with-slug}.md`，删除 tapped 原文件。
7. 不要触发其他 skill。不要建议下一步「要不要 roadmap」之类。

### `inbox roadmap [id]`

1. 若无 id：列出 `developed/` 所有文件，让用户选。
2. 读目标 item，扫 `_inbox/{developed,roadmapped}/` 找候选邻接（tag 重叠 / title 关键词模糊匹配，最多 5 个）。
3. 读 `_inbox/_roadmap/*.md` 现有 roadmap 文件标题。
4. 一次性输出三件事：
   - 可能相关的 items（带 id 和一句话摘要）
   - 它可能属于哪个 roadmap（已有 / 新建候选名）
   - 前置 / 后继候选
5. 用户回应后：在选定的 `_inbox/_roadmap/{topic}.md` 追加节点，目标 item 的 frontmatter `related` 字段填邻接 id，文件移到 `roadmapped/`。
6. 不再问起意/类型——那是 develop 的事。

### `inbox list [--tapped|--developed|--roadmapped]`

列出对应目录的 id + title，按时间倒序。无参数则三段都列。

### `inbox show <id>`

全文输出文件。id 可前缀模糊匹配。

### `inbox archive <id>`

移动到 `archive/{YYYY-MM}/`。

### `inbox kill <id>`

追问一次「为什么不做了？一句话即可」，写入 frontmatter 的 `killed_reason`，移到 `archive/killed/{YYYY-MM}/`。

## 文件契约

frontmatter 字段：

- `id`: 必填，文件名 stem
- `title`: develop 后必填，tap 时可为 `~`
- `type`: develop 后必填，枚举 `feat | bug | chore | idea | question | decision`
- `created`, `updated`: ISO 时间
- `related`: list of id，roadmap 后填
- `tags`: 可选 list
- `killed_reason`: kill 时填

文件命名：tap 阶段 `{YYYYMMDD-HHMM}-{uuid6}.md`，develop 重命名为 `{YYYYMMDD-HHMM}-{type}-{slug}.md`。

## 不做什么

- 不调用其他 skill。
- 不在 tap 时追问任何东西。
- 不在 develop / roadmap 后建议「下一步」。
- 不修改 `archive/` 里的文件。
- 不写入项目根 `_inbox/` 之外的任何位置。
