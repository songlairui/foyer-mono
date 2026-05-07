---
id: 20260507-mdreader-02-a2aa0c
created: 2026-05-07T12:00:00+08:00
updated: 2026-05-07T18:00:00+08:00
title: init-project 在发起位置收集简要元信息
type: feat
tags: [skill, init-project, inbox]
source: md-reader
status: in-progress
started: 2026-05-07T18:00:00+08:00
---

## 起意

md-reader 的 vitepress.md 笔记中反馈：init-project 技能可以在发起位置收集简要元信息——如果目录在 repo 下则关联为发起 repo。project 关系使用 `init-from` 类型。

用户在对话中说"帮我初始化一个项目"，此时 init-project 应自动捕获当前所在 repo 作为 `init-from` 关联。

## 决定

### 现有 event schema 现状

`project.created` 事件的顶层字段（来自 `ActivityEventSchema`）已有：`id`、`ts`、`device`、`event`、`project`（slug）、`lane`、`owner`、`summary`、`raw_ref`、`source`、`parents`、`data`、`hash`。

`data` 字段（`z.record(z.string(), z.unknown())`）在 `executeProjectInit` 中当前写入了三个键：

- `description`：项目描述文本
- `projectPath`：本地绝对路径
- `repositoryUrl`：GitHub 仓库 URL（可选）

`ProjectInitRequest` 的输入字段有：`slug`、`description`、`lane`、`owner`、`projectsRoot`、`foyerRoot`、`entryRoot`、`githubOwner`、`githubVisibility`、`createGithub`、`dryRun`、`deviceName`。

**结论**：没有任何现有字段承载"发起位置"的关联信息，需要在 `data` 中扩展，而非修改顶层 schema。

---

### 关系模型设计

#### `init-from` 关系

**含义**：本项目由某个 repo 发起初始化。值为发起 repo 的标识符，格式尽可能精简为 `username/repo`。

**值的三层 fallback**（由 skill 层 shell 命令完成，不经 LLM 编排；检测逻辑内置于 foyer CLI TS 代码）：

1. **有 git remote，命中 Foyer 项目列表**：运行 `git remote get-url origin`，再运行 `foyer project list --json`，对比 `repositoryUrl` 字段（去协议/后缀规范化后精确匹配）。命中时取该项目的 Foyer slug。
2. **有 git remote，但无 Foyer 匹配**：从 remote URL 中提取 `username/repo`（去 `.git`、统一 https/ssh 格式），直接用作 `initFrom` 值。
3. **无 git remote**：取 repo 根目录相对于 `~` 的路径作为 slug（如 `repo/projects/my-app`）。

**覆盖范围**：不强制要求 `init-from` 指向体系内已知项目，`username/repo` 格式的外部 repo 也合法。即使三层均检测失败，流程仍继续，`initFrom` 保持 undefined。

**数据位置**：写入 `project.created` 事件的 `data.initFrom`（string，optional）。

**CLI 接口**：`ProjectInitRequestSchema` 增加可选字段 `initFrom?: string`，透传到 `executeProjectInit` 并写入 `data`。

**skill 层行为**：执行 shell 命令检测（见 `SKILL.md` 步骤 3）；在 dry-run 计划中展示 `init-from: <value>`；用户确认后加入 `--init-from <value>` 参数执行。

---

### 分层职责

| 职责                              | 层级                | 理由                                                       |
| --------------------------------- | ------------------- | ---------------------------------------------------------- |
| 检测 git remote + 匹配 Foyer 列表 | skill 层 shell 命令 | LLM 处理需传入大量上下文，不合理；shell 命令轻量、无副作用 |
| 解析 remote URL → username/repo   | skill 层 shell 命令 | 字符串规范化，不需要 LLM                                   |
| fallback 到 repo 根目录路径       | skill 层 shell 命令 | 同上                                                       |
| 展示检测结果并确认                | skill 层（agent）   | agent 有对话上下文，负责用户交互                           |
| 持久化 `initFrom` 到 `data`       | CLI 层              | CLI 负责写 event，保持 schema 的单一来源                   |

---

### event schema 扩展方案

在 `executeProjectInit` 写入 `data` 时追加可选键：

```typescript
data: {
  description: request.description,
  projectPath: targetProjectPath,
  repositoryUrl,
  // 新增（可选）：
  initFrom: request.initFrom,  // string | undefined，格式为 username/repo 或 Foyer slug 或 ~/相对路径
}
```

`ProjectInitRequestSchema` 新增：

```typescript
initFrom: z.string().optional(),
```

`listProjects` 读取 `event.data.initFrom` 时使用已有的 `stringData()` 辅助函数，无需改动读取逻辑。向后兼容：老 event 的 `data.initFrom` 为 undefined，`stringData()` 返回 undefined，`foyer project list` 不受影响。

---

### skill 层工作流（`init-project/SKILL.md`）

检测步骤已落入 `SKILL.md` 步骤 3，使用 shell 命令实现三层 fallback，不依赖独立脚本文件。

---

### CLI flag 映射

```
foyer project init <slug> --desc "..." --lane <lane> --owner <owner> \
  [--init-from <value>]    # 由 skill 自动填入，用户也可手动传
  --github --json
```

---

### 最小可交付

1. `ProjectInitRequestSchema` 加 `initFrom?: string` 字段
2. `executeProjectInit` 把 `initFrom` 写入 `data`
3. skill 层使用 shell 命令实现三层 fallback 检测（内联在 `SKILL.md`）
4. `init-project/SKILL.md` 加入检测步骤
5. `ProjectListItemSchema` 加 `initFrom?: string`，`renderProjectList` 渲染该字段

`quoted` 关系不在本次交付范围，待可视化功能上线后支持手动关联再设计。

---

## TODO

- [x] `contracts.ts`：`ProjectInitRequestSchema` 增加 `initFrom?: string`
- [x] `project-init.ts`：`executeProjectInit` 的 `data` 写入 `initFrom`（来自 `request.initFrom`）
- [x] CLI 入口：增加 `--init-from` flag，映射到 `initFrom` 字段
- [x] `init-project/SKILL.md`：在工作流步骤 3 插入「发起位置检测」，含三层 fallback 的 shell 命令
- [x] `ProjectListItemSchema`：增加 `initFrom?: string`，`renderProjectList` 渲染该字段
- [ ] 完成后通知 md-reader

<details>
  <summary>原文</summary>

start 20260507-mdreader-02-feat-init-project-metadata; 问题修订: 当前目录 git remote, 匹配 foyer project list --json , 这些肯定由 sh 脚本完成, LLM 处理,要传入大量上下文,肯定不合理; 没有命中,则检测 git remote, 取 slug-name; 如果没有 git remote, 直接取 repo 根目录,取 slug (从 ~ 开始); quoted 不需要了,未来有可视化之后,支持手动关联再设计. init-from 尽可能的 username/repo 这样精简; 失败后,也会有目录的. 不匹配体系内目录,也允许.; 6. 写入 ProjectListItemSchema

</details>
