---
id: 20260507-mdreader-02-a2aa0c
created: 2026-05-07T12:00:00+08:00
updated: 2026-05-07T17:09:27+08:00
title: init-project 在发起位置收集简要元信息
type: feat
tags: [skill, init-project, inbox]
source: md-reader
status: todo
---

## 起意

md-reader 的 vitepress.md 笔记中反馈：init-project 技能可以在发起位置收集简要元信息——如果是对话则摘要上下文，如果目录在 repo 下则关联为发起 repo。进一步，project 关系可以有 `init-from` 和 `quoted` 两种类型。

用户在对话中说"帮我初始化一个项目"，此时 init-project 应自动捕获：

- 当前对话的简要摘要（作为项目背景）
- 当前所在 repo（作为 init-from 关联）
- 用户提到的引用资料

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

**含义**：本项目由另一个 Foyer 项目的 repo 发起初始化。值为发起项目的 slug。

**触发条件**：skill 层在执行前，在当前工作目录（cwd）运行 `git remote get-url origin`，并将结果与 `foyer project list --json` 的 `repositoryUrl` 字段做匹配。若命中，自动填入。

**数据位置**：写入 `project.created` 事件的 `data.initFrom`（string，kebab-case slug）。

**CLI 接口**：在 `ProjectInitRequestSchema` 中增加可选字段 `initFrom?: string`（ProjectSlug，optional），透传到 `executeProjectInit` 并写入 `data`。

**skill 层行为**：在 dry-run 之前尝试自动检测；检测到后在 dry-run 计划中展示给用户确认；用户确认后加入 `--init-from <slug>` 参数执行。

#### `quoted` 关系

**含义**：初始化时用户明确引用的参考资料（文件路径或 URL）。值为 string 数组。

**当前决定**：`quoted` 关系在最小版本中**暂不实现**。理由见「待用户确认」章节。

---

### 分层职责

| 职责                          | 层级              | 理由                                                             |
| ----------------------------- | ----------------- | ---------------------------------------------------------------- |
| 检测当前目录 git remote       | skill 层（agent） | agent 有对话上下文和当前目录信息，CLI 无法独立感知               |
| 匹配 remote URL 到 Foyer slug | skill 层（agent） | 需调用 `foyer project list --json` 并比对，属于 agent 的编排逻辑 |
| 持久化 `initFrom` 到 `data`   | CLI 层            | CLI 负责写 event，保持 schema 的单一来源                         |
| 收集用户引用资料              | skill 层（agent） | 属于对话理解，CLI 不感知                                         |

---

### event schema 扩展方案

在 `executeProjectInit` 写入 `data` 时追加可选键：

```typescript
data: {
  description: request.description,
  projectPath: targetProjectPath,
  repositoryUrl,
  // 新增（均为可选）：
  initFrom: request.initFrom,          // string | undefined，发起项目 slug
}
```

`ProjectInitRequestSchema` 新增：

```typescript
initFrom: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).optional(),
```

`listProjects` 读取 `event.data.initFrom` 时使用已有的 `stringData()` 辅助函数，无需改动读取逻辑。向后兼容：老 event 的 `data.initFrom` 为 undefined，`stringData()` 返回 undefined，`foyer project list` 不受影响。

---

### skill 层工作流更新（`init-project/SKILL.md`）

在现有步骤 1（提取参数）之前，插入「发起位置检测」子步骤：

1. **（新）检测 init-from**：在 cwd 运行 `git remote get-url origin`，获取 remote URL。
2. **（新）匹配 Foyer 项目**：运行 `foyer project list --json`，将 `repositoryUrl` 与 remote URL 比对（精确匹配或去协议前缀的宽松匹配）。
3. **（新）展示并确认**：若匹配命中，在 dry-run 计划中展示 `init-from: <slug>`，用户确认后加入参数。
4. **（新）fallback**：若当前目录不在 git repo 内，或 remote URL 无法匹配任何 Foyer 项目，则静默跳过，不中断流程。

---

### CLI flag 映射

```
foyer project init <slug> --desc "..." --lane <lane> --owner <owner> \
  [--init-from <slug>]    # 由 skill 自动填入，用户也可手动传
  --github --json
```

---

### 最小可交付（第一步）

只交付 `init-from` 自动检测，具体为：

1. `ProjectInitRequestSchema` 加 `initFrom` 字段
2. `executeProjectInit` 把 `initFrom` 写入 `data`
3. `init-project/SKILL.md` 加入检测步骤
4. （可选）`foyer project list` 的输出中渲染 `init-from` 字段

`quoted` 关系、对话摘要捕获均不在本次交付范围。

---

## TODO

- [ ] `contracts.ts`：`ProjectInitRequestSchema` 增加 `initFrom?: ProjectSlugSchema`
- [ ] `project-init.ts`：`executeProjectInit` 的 `data` 写入 `initFrom`（来自 `request.initFrom`）
- [ ] CLI 入口：增加 `--init-from` flag，映射到 `initFrom` 字段
- [ ] `init-project/SKILL.md`：在工作流步骤 1 之前插入「发起位置检测」子步骤，并说明 fallback 规则
- [ ] （可选）`renderProjectList` / `ProjectListItemSchema`：渲染 `initFrom` 字段
- [ ] 完成后通知 md-reader

## 待用户确认

### Q1：`quoted` 关系是否过度设计？

**现状**：`quoted` 的值是文件路径或 URL 的数组，来源是 agent 从对话中提取用户提到的资料。

**疑虑**：

- 这是 agent 的推断，不是用户的显式输入，准确率难以保证。
- 落入 `data` 后难以校验；落入独立 `project.related` event 则带来新的 event type 和读取复杂度。
- 现有 `foyer search` 和 `graphify` 已能通过内容语义关联资料，`quoted` 的增量价值有限。

**建议**：最小版本完全舍弃 `quoted`，待 `init-from` 落地后再评估实际需求。

**需确认**：是否同意在本 feat 中不设计 `quoted`？

---

### Q2：`init-from` 匹配逻辑：精确匹配还是宽松匹配？

remote URL 形式多样（`https://github.com/user/repo`、`git@github.com:user/repo`、`https://github.com/user/repo.git`），而 Foyer 存储的 `repositoryUrl` 目前格式为 `https://github.com/<owner>/<slug>`。

**需确认**：匹配时是否需要做协议/后缀规范化（去 `.git`、统一 https/ssh 格式），还是只做 `repositoryUrl` 子串包含？

---

### Q3：`init-from` 检测失败时是否提示？

**两种方案**：

- **静默跳过**：检测失败（不在 git repo 内、无 remote、无匹配项）时不提示，直接继续。用户无感知。
- **轻提示**：在 dry-run 计划输出中加一行 `init-from: 未检测到（当前目录不在已知 Foyer 项目下）`，让用户知晓检测发生过。

**建议**：轻提示更透明，但增加输出噪音。倾向静默跳过，但需确认。

---

### Q4：`init-from` 是否需要写入 `ProjectListItemSchema`？

目前 `listProjects` 读取 `data.initFrom` 只需用 `stringData()` 即可，但 `ProjectListItemSchema` 和 `ProjectListItem` 类型中没有该字段，渲染层也不展示。

**需确认**：是否要在 `ProjectListItemSchema` 中增加 `initFrom?: string`，并在 `renderProjectList` 中渲染（类似 `repositoryUrl` 的处理方式）？还是第一步只写入 event、不改 list 输出？
