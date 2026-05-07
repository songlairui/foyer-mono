---
id: 20260507-mdreader-03-6a91b9
created: 2026-05-07T12:05:00+08:00
updated: 2026-05-07T17:09:11+08:00
title: foyer cli — 跨项目投递信息能力
type: feat
tags: [cli, inbox, inter-project]
source: md-reader
status: todo
---

## 起意

md-reader 的 KICK_OFF 阶段需要向 foyer-mono 投递多个 feature request。当前做法是手动写入对方 `_inbox/tapped/` 目录，流程零散且无法追溯。需要将这一跨项目投递行为固化为 CLI 能力，使其可重复、可审计、有来源记录。

## 决定

### 新增命令：`foyer inbox send <project-slug>`

向指定项目的 `_inbox/tapped/` 投递一条信息条目。

**命令签名（设计态）**

```
foyer inbox send <slug>
  --type <type>           # feature-request | feedback | idea | notify（必填）
  --title <text>          # 条目标题（必填）
  --text <text>           # 正文内容（与 --raw-file 二选一）
  --raw-file <path>       # 原始 md 文件路径（与 --text 二选一）
  --source-project <slug> # 来源项目 slug（可选，默认从当前 foyer 的项目列表推断）
  --foyer-root <path>     # Foyer 数据根，用于查找目标项目路径
  --json                  # 稳定 JSON 输出
```

**与现有 `foyer inbox append` 的区分**

| 维度     | `inbox append`                                         | `inbox send`                                                             |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| 写入位置 | 当前 foyer 数据根的 `inbox/yyyy/mm/ymd.md`（日志追加） | 目标项目仓库的 `_inbox/tapped/<id>-<slug>.md`（独立文件）                |
| 文件格式 | 追加行（`## ts project\n\ncontent`）                   | 带 frontmatter 的独立 md 条目                                            |
| 跨项目   | 否（`--project` 仅是标签）                             | 是（需要解析目标项目的本地路径）                                         |
| 代码复用 | —                                                      | 不能直接复用 `appendInbox`；可复用文件名生成规范和 `appendActivity` 记录 |

两者职责不同，必须新增 `send` 命令，而非扩展 `append` 的 `--project` 参数。

**目标项目路径解析**

依赖 `listProjects` workflow 中已有的 `projectPath` 字段（来自 activity event `data.projectPath`）。调用链：

1. `listProjects({ entryRoot })` 返回 `ProjectListResult.projects[]`
2. 在结果中找 `slug === target` 的条目，取 `projectPath`
3. 拼接 `path.join(projectPath, "_inbox", "tapped", filename)`

若 `projectPath` 为空（项目未在本机 clone），或路径在本机不存在，则以 `EntryWorkflowError` 报错，不做任何写入。

**写入文件格式**

文件名：`<yyyymmdd>-<hhmmss>-<type>-<title-kebab>.md`（时间戳 + 类型 + 标题，确保可排序）

文件内容（frontmatter + 正文）：

```markdown
---
id: <yyyymmdd>-<source-slug>-<hex6>
created: <ISO8601>
title: <title>
type: <type>
source: <source-project-slug>
status: tapped
---

<content>
```

`source` 字段自动写入来源项目 slug，供目标项目的 `foyer inbox check` 或人工过滤使用。

**Activity event 记录**

投递成功后，在来源项目的 foyer 数据根写入 `inbox.sent` event，字段：

```json
{
  "event": "inbox.sent",
  "project": "<source-project-slug>",
  "data": {
    "targetProject": "<target-slug>",
    "targetFile": "<绝对路径>",
    "type": "<type>",
    "title": "<title>"
  },
  "summary": "向 <target-slug> 投递 <type>：<title>"
}
```

### `foyer inbox check`（最小版本，仅展示，不实现）

扫描当前项目 `_inbox/tapped/` 目录，过滤 `status: tapped` 且尚未处理的条目，并在 frontmatter 中识别 `source` 字段非空的条目（表示对方期待回信）。

本次 **不实现** `foyer inbox check`，不实现 `--type notify` 回信写回。最小可交付仅为 `foyer inbox send`。

## TODO

- [ ] 实现 `sendInbox` workflow（`packages/cli/src/workflows/inbox.ts`）
  - [ ] 接受 `targetSlug, type, title, text|rawFile, sourceProject, entryRoot`
  - [ ] 调用 `listProjects` 解析目标 `projectPath`
  - [ ] 若 `projectPath` 未知或本机不存在，返回 `EntryWorkflowError("TARGET_NOT_LOCAL", ...)`
  - [ ] 生成文件名（时间戳 + hex6）
  - [ ] 渲染 frontmatter + 正文，写入目标 `_inbox/tapped/<filename>`
  - [ ] 写入 `inbox.sent` activity event 到来源 foyer 数据根
- [ ] 在 `packages/cli/src/cli/index.ts` 注册 `foyer inbox send` 命令
- [ ] 单元测试：路径解析 / 目标不存在 / 文件名冲突防御
- [ ] 完成后通知 md-reader（通过 `foyer inbox send md-reader --type notify`）

## 待用户确认

以下问题需要拍板后才能进入实现阶段：

**Q1：文件名冲突策略**

写入目标 `_inbox/tapped/` 时，文件名含时间戳 + hex6，理论上重复概率极低，但若同一秒并发投递仍可能冲突。设计选项：

- A（当前设计）：时间戳 + `openssl rand -hex 3`，出现冲突时报错，由调用方重试
- B：检测冲突后自动追加序号后缀（`-2`、`-3`）
- C：完全用 UUID，放弃可读性

倾向 A，但需确认。

**Q2：`sourceProject` 如何确定**

来源项目 slug 谁来提供？选项：

- A：调用方必须传 `--source-project <slug>`（显式，无歧义）
- B：从当前 foyer 数据根的最近 activity event 推断「当前活跃项目」（隐式，可能出错）

倾向 A（显式）。需确认是否接受必填参数。

**Q3：目标项目未在本机的处理**

`listProjects` 的 `projectPath` 可能为空（项目从未在本机 init），或路径存在但目录已被删除。设计选项：

- A：直接报错 `TARGET_NOT_LOCAL`，提示用户先 `foyer repo prepare <slug>`
- B：若 `projectPath` 为空但 `repositoryUrl` 存在，自动调用 `repoPrepare` clone 后再投递

B 副作用大（自动 clone 可能消耗时间且用户无预期）。倾向 A，但需确认是否接受这个限制。

**Q4：`foyer inbox check` 是否纳入本期**

tap 原文列出了 `foyer inbox check` 和 notify 回信。考虑最小可交付原则，建议本期只交付 `foyer inbox send`，`check` 推迟。需确认优先级。

**Q5：写入目标项目后是否需要 git commit**

投递后目标项目的 `_inbox/tapped/` 会有新文件，是否由 `send` 命令自动做 `git add && git commit`（或提示用户）？

- A：不自动提交，文件写入后由用户自行 commit
- B：自动在目标项目执行 `git add <file> && git commit -m "inbox: <source> sent <type>"`

A 更安全（不侵入目标项目的 git 工作区）。倾向 A，需确认。
