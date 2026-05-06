# 存档层数据格式与全文抽取方案

调研日期：2026-05-05

## 结论

当前 `jsonl` 作为存档层事实源是合理的，应继续保留。关键约束是：大模型不直接读取原始 `jsonl`，只通过 CLI 查询、裁剪、导出上下文。这样可以让存档无限增长，同时避免每次任务把历史事件整体塞进上下文。

graphify 和 Hyper-Extract 不应替代 canonical storage。它们更适合作为派生处理层：

- graphify：适合把一批文件、笔记、代码、图片、PDF、视频等转为可查询知识图谱，生成 `graph.json`、`GRAPH_REPORT.md`、`graph.html`、wiki、MCP 查询入口。
- Hyper-Extract：适合把非结构文本转成强类型 Knowledge Abstract，支持 graph、hypergraph、temporal graph、spatial graph、spatio-temporal graph，并提供 `he parse/feed/search/show/talk` 这种 CLI 切面。

因此推荐架构是：

```text
append-only jsonl 事实层
  -> foyer CLI 查询/裁剪
  -> 全文 corpus 投影层
  -> graphify / Hyper-Extract / FTS / vector index 等派生层
  -> agent 可读报告、图谱、wiki、搜索结果
```

一句话：`jsonl` 保存“发生了什么”，graphify/Hyper-Extract 帮助理解“这些事实之间意味着什么”。

## 为什么继续用 JSONL

`jsonl` 很适合 `entry` 的 append-only 协议：

- 天然追加：每条事件一行，写入简单，不需要重写整个文件。
- 易同步：按 device/date 分片后，跨设备同步可以按文件、seq、hash、frontier 合并。
- 易恢复：写坏一行不会毁掉整个数据库。
- 易审计：每条事实都有 `ts`、`device`、`event`、`project`、`raw_ref`、`parents`、`hash`。
- 易生成视图：daily inbox、project page、timeline、weekly review 都可从事件派生。

它不适合直接给 LLM 全量读取。解决方式不是换格式，而是严格建立 CLI 边界：

```bash
foyer activity query --project entry-init-project --since 2026-05-01 --json
foyer activity context --project entry-init-project --budget 4000 --format markdown
foyer activity export --scope project:entry-init-project --target graphify-corpus
foyer activity export --scope project:entry-init-project --target hyperextract-input
```

大模型看到的是查询结果、摘要、引用片段或派生文档，不是原始日志全集。

## 基础分层

推荐把存储分成五层：

| 层         | 形式                                   | 是否 canonical | 是否给 LLM 直接读   | 用途                         |
| ---------- | -------------------------------------- | -------------- | ------------------- | ---------------------------- |
| 事实层     | `activity/events/**/*.jsonl`           | 是             | 否                  | 不可变事件、跨设备同步、审计 |
| 内容层     | inbox、project page、blob、附件        | 部分是         | 通过 CLI 片段读取   | 原话、长文本、人工可读资料   |
| 视图层     | Markdown index、timeline、daily review | 否             | 可以                | 人和 agent 的低成本入口      |
| 全文索引层 | SQLite FTS、tantivy、vector index      | 否             | 只读查询结果        | 搜索、召回、排序             |
| 抽取层     | graphify、Hyper-Extract 输出           | 否             | 可以读报告/查询接口 | 图谱、强类型知识、推理入口   |

其中只有事实层和用户明确保存的内容层是 source of truth。其他层都应该可删除、可重建。

## 场景对比

### 场景 1：普通回溯

问题：今天创建了哪些项目？某个项目什么时候被初始化？

最佳路径：

```bash
foyer activity query --event project.created --since today --json
foyer project timeline <slug> --format markdown
```

不需要 graphify 或 Hyper-Extract。直接读 JSONL 的结构化字段即可。

### 场景 2：给 agent 一段上下文

问题：让 agent 继续推进某个项目，但不能读完整历史。

最佳路径：

```bash
foyer activity context --project <slug> --budget 6000 --format markdown
```

CLI 应返回：

- 当前目标
- 最近决策
- 最近文件/PR/commit
- open questions
- 引用到原始 `raw_ref` 的短片段

这属于“上下文压缩视图”，不需要复杂抽取。

### 场景 3：跨项目找关联

问题：哪些项目都涉及 agent delivery、skill、CLI、entry 协议？这些概念之间如何连接？

适合 graphify。先由 CLI 导出 Markdown corpus：

```bash
foyer activity export --scope all-projects --target graphify-corpus --out .entry-derived/graphify/all-projects/corpus
graphify .entry-derived/graphify/all-projects/corpus --update --wiki --no-viz
graphify query "哪些项目都与 skill 和 CLI 的分发有关？" --graph .entry-derived/graphify/all-projects/graphify-out/graph.json
```

graphify 的优势是跨文件、跨格式、跨概念建图，并给出 god nodes、surprising connections、suggested questions、confidence 标签。

### 场景 4：把项目历史抽成强类型结构

问题：把某个项目的推进历史抽成 “目标、决策、阻塞、里程碑、交付物、下一步”。

适合 Hyper-Extract。先导出项目纪要：

```bash
foyer activity export --scope project:<slug> --target hyperextract-input --out .entry-derived/hyperextract/<slug>/input.md
he parse .entry-derived/hyperextract/<slug>/input.md -t entry/project_timeline -o .entry-derived/hyperextract/<slug>/timeline -l zh
he search .entry-derived/hyperextract/<slug>/timeline "当前最大的阻塞是什么？"
```

Hyper-Extract 的优势是模板驱动和强类型输出。我们可以自定义 `entry/project_timeline`、`entry/decision_graph`、`entry/conflict_case` 等模板。

### 场景 5：持续增量更新

问题：项目每天都有新事件，希望抽取层持续跟进。

JSONL 仍是源头。派生层维护 cursor：

```text
.entry-derived/
  cursors/
    graphify-all-projects.json
    hyperextract-entry-init-project.json
```

更新流程：

```bash
foyer activity export --since-cursor graphify-all-projects --target graphify-corpus
graphify .entry-derived/graphify/all-projects/corpus --update

foyer activity export --since-cursor hyperextract-entry-init-project --target markdown-fragment
he feed .entry-derived/hyperextract/entry-init-project/timeline new-fragment.md
```

Hyper-Extract 的 `feed` 明确支持在已有 Knowledge Abstract 上增量加入新文档，并处理实体/关系合并；graphify 也提供 `--update` 和缓存机制。

### 场景 6：多设备冲突解释

问题：两个设备同时更新同一项目，如何保留事实并解释冲突？

存储层不应让 graphify/Hyper-Extract 直接参与合并。正确流程：

1. JSONL 保留两条事实。
2. frontier/manifest 发现冲突。
3. CLI 生成 conflict note。
4. 可选用 Hyper-Extract 抽取冲突结构：参与设备、字段、候选值、时间、证据。
5. 用户确认后写入 `decision.recorded`。

graphify 可用于看冲突涉及哪些项目和概念；Hyper-Extract 可用于抽取冲突案件结构。但二者都不应决定 canonical truth。

### 场景 7：全文搜索与精确引用

问题：想搜到原话，并能回到 inbox 或 event。

最佳路径是本地 FTS 派生层，而不是知识图谱：

```text
.entry-derived/fts/
  entry.sqlite
```

索引字段：

- `event_id`
- `project`
- `lane`
- `ts`
- `summary`
- `raw_text`
- `raw_ref`
- `source_path`

CLI：

```bash
foyer search "Flue agent 交付形式" --project entry-init-project --limit 10 --json
foyer get event <event-id> --format markdown
```

FTS 负责找“原话在哪里”；graphify/Hyper-Extract 负责“概念和关系是什么”。

## graphify 调研

graphify 的定位是 agent skill + Python library。它可以把任意文件夹里的 code、docs、PDF、图片、视频等抽成知识图谱。典型命令：

```bash
graphify .
graphify ./docs --update
graphify . --wiki
graphify query "what connects auth to the database?"
graphify path "A" "B"
graphify explain "Concept"
python -m graphify.serve graphify-out/graph.json
```

它的输出：

```text
graphify-out/
  graph.html
  GRAPH_REPORT.md
  graph.json
  wiki/
  cache/
```

内部抽取 schema 非常接近普通知识图谱：

```json
{
  "nodes": [
    {
      "id": "unique_string",
      "label": "human name",
      "source_file": "path",
      "source_location": "L42"
    }
  ],
  "edges": [
    {
      "source": "id_a",
      "target": "id_b",
      "relation": "calls|imports|uses|...",
      "confidence": "EXTRACTED|INFERRED|AMBIGUOUS"
    }
  ]
}
```

最终 `graph.json` 使用 NetworkX node-link 风格，并给节点增加 community，给边增加 confidence score。graphify 还支持 wiki、Obsidian、SVG、GraphML、Neo4j Cypher 和 MCP server。

对 `entry` 的启发：

- `source_file` / `source_location` 必须成为所有派生节点的基础字段。
- `confidence` 很有价值。`entry` 派生关系也应标记 `EXTRACTED`、`INFERRED`、`AMBIGUOUS`。
- 图谱输出应可提交或缓存，但不应作为事实源。
- graphify 适合读取导出的 Markdown corpus，而不是直接读取 `activity/events/**/*.jsonl`。

不建议直接使用 graphify 的格式作为存档层，因为它面向“知识图谱结果”，不是 append-only 事件源。

## Hyper-Extract 调研

Hyper-Extract 的定位是 LLM 驱动的知识抽取与演进框架。它的核心是 Knowledge Abstract，支持 8 种 Auto-Types：

- `AutoModel`
- `AutoList`
- `AutoSet`
- `AutoGraph`
- `AutoHypergraph`
- `AutoTemporalGraph`
- `AutoSpatialGraph`
- `AutoSpatioTemporalGraph`

CLI 入口：

```bash
he config init -k YOUR_OPENAI_API_KEY
he parse INPUT -t general/biography_graph -o ./output/ -l zh
he search ./output/ "问题"
he show ./output/
he feed ./output/ new_doc.md
he build-index ./output/
```

`he parse` 的输出目录：

```text
output/
  data.json
  metadata.json
  index/
    index.faiss
    docstore.json
```

`he feed` 会加载已有 Knowledge Abstract，抽取新文档，并合并实体和关系。它特别适合“长期演进的结构化知识”。

对 `entry` 的启发：

- 可以设计 `entry` 专用 YAML templates，而不是只用通用模板。
- 对项目历史，`AutoTemporalGraph` 比普通 graph 更合适。
- 对多设备冲突、家庭/项目多 owner 协作，`AutoHypergraph` 可能比二元关系更自然。
- 对地点/设备/仓库拓扑，`AutoSpatialGraph` 或普通 graph 加 device/location 字段即可。

不建议把 Hyper-Extract 的 `data.json` 当作 canonical storage，因为它是抽取结果，可能受模型、模板、版本、增量合并策略影响。它适合当作可重建的派生知识摘要。

## 是否直接采用它们需要的形式

答案分三层：

### 1. Canonical 层：不要

不要把 `activity/events/**/*.jsonl` 改成 graphify 的 `graph.json` 或 Hyper-Extract 的 `data.json`。原因：

- graph/hypergraph 是关系视图，不是事件日志。
- 抽取结果可能包含推断，不能替代原始事实。
- 外部工具 schema 会演进，不能绑住核心存档层。
- canonical 层必须支持精确审计和冲突保留。

### 2. 投影层：可以直接适配

可以生成它们最喜欢的输入形式：

```text
.entry-derived/
  graphify/
    all-projects/
      corpus/
        index.md
        projects/<slug>.md
        days/2026-05-05.md
      graphify-out/
  hyperextract/
    projects/<slug>/
      input.md
      timeline/
        data.json
        metadata.json
        index/
```

graphify 适合“文件夹 corpus”；Hyper-Extract 适合“单个或多个 Markdown 文档 + template + output dir”。

### 3. 设计层：应该借鉴

应该借鉴这些设计：

- graphify 的 confidence 标签和 source trace。
- graphify 的 `query/path/explain` CLI 切面。
- graphify 的 wiki/MCP 输出，供 agent 低成本读取。
- Hyper-Extract 的 Auto-Type 选择树。
- Hyper-Extract 的 YAML template，把抽取目标变成版本化配置。
- Hyper-Extract 的 `parse/feed/search/show` 生命周期。

## 推荐目录结构

```text
~/.foyer/
  activity/
    events/<device>/<YYYY>/<MM>/<DD>.jsonl
    nodes/<hash>.json
    frontier/<device>.json
    manifests/<device>.json
    views/
    derived/
      cursors/
      text/
      fts/
      graphify/
      hyperextract/
```

也可以把大体积派生物放到项目工作区或缓存目录，避免污染 `~/.foyer`：

```text
~/.cache/foyer/
  graphify/
  hyperextract/
  fts/
```

原则：`~/.foyer/activity/events` 是事实；`derived` 是缓存。缓存可删，事实不可丢。

## 推荐 CLI 设计

### 查询层

```bash
foyer activity query --project <slug> --since 2026-05-01 --json
foyer activity context --project <slug> --budget 6000 --format markdown
foyer search "关键词" --json
foyer get event <event-id> --format markdown
```

### 投影层

```bash
foyer export text --scope project:<slug> --out derived/text/<slug>.md
foyer export corpus --scope all-projects --out derived/graphify/all-projects/corpus
foyer export hyperextract --scope project:<slug> --template entry/project_timeline --out derived/hyperextract/<slug>/input.md
```

### 派生层

```bash
foyer derive graphify --scope all-projects --update
foyer derive hyperextract --scope project:<slug> --template entry/project_timeline --feed
foyer derive fts --rebuild
```

### Agent 入口

```bash
foyer ask "这个项目下一步是什么？" --project <slug>
foyer graph query "skill、flue、cli 的关系是什么？"
foyer ka search <slug> "最近的决策是什么？"
```

## 建议的事件 envelope

JSONL 事件可以保持小而稳定：

```json
{
  "id": "01HX...",
  "device": "mbp14",
  "seq": 42,
  "ts": "2026-05-05T20:30:00+08:00",
  "type": "project.created",
  "project": "entry-init-project",
  "lane": "agent_loop_research",
  "summary": "创建 entry-init-project 项目，用于把 init-project skill 演进为多交付形式能力。",
  "raw_ref": "inbox/2026/05/2026-05-05.md#raw-capture-...",
  "body_ref": "blobs/sha256/...",
  "entities": ["init-project", "Flue", "Skill", "CLI"],
  "relations": [
    {
      "source": "init-project",
      "target": "CLI",
      "type": "should-delegate-to",
      "confidence": "EXTRACTED"
    }
  ],
  "parents": ["01HW..."],
  "hash": "sha256:..."
}
```

注意：

- `summary` 可短。
- 长文本放 `raw_ref` 或 `body_ref`。
- `entities/relations` 只放确定性或人工确认的轻量索引，不追求完整图谱。
- 完整图谱交给 graphify/Hyper-Extract 派生层。

## Graphify 投影格式

建议由 CLI 导出 Markdown corpus，而不是 JSONL：

```text
derived/graphify/all-projects/corpus/
  index.md
  projects/
    entry-init-project.md
  days/
    2026-05-05.md
  decisions/
    2026-05-05-agent-delivery-matrix.md
```

每个文档头部携带稳定元数据：

```markdown
---
entry_scope: project
project: entry-init-project
source_events:
  - 01HX...
source_refs:
  - inbox/2026/05/2026-05-05.md#raw-capture-...
generated_at: 2026-05-05T21:00:00+08:00
---

# entry-init-project

## 目标

...

## 决策

...
```

这样 graphify 可以从自然文档中抽取概念，同时保留回源路径。

## Hyper-Extract 模板方向

建议新增一组 `entry` 模板：

```text
templates/entry/
  project_timeline.yaml
  decision_graph.yaml
  conflict_case.yaml
  delivery_matrix.yaml
  device_repo_topology.yaml
```

模板选择：

| 模板                   | Auto-Type              | 用途                            |
| ---------------------- | ---------------------- | ------------------------------- |
| `project_timeline`     | AutoTemporalGraph      | 项目事件、决策、里程碑          |
| `decision_graph`       | AutoGraph              | 决策、依据、影响、后续动作      |
| `conflict_case`        | AutoHypergraph         | 多设备/多人/多文件冲突          |
| `delivery_matrix`      | AutoModel 或 AutoGraph | CLI、skill、plugin、Flue 的关系 |
| `device_repo_topology` | AutoGraph              | 设备、repo、clone、remote、状态 |

Hyper-Extract 的价值在于 schema 可声明、可版本化。模板应和 `entry` 的领域语言共同演进。

## 风险与防线

| 风险                            | 防线                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| LLM 直接读 JSONL 导致上下文膨胀 | skill/plugin 明确禁止，`.graphifyignore` 忽略 `activity/events/`，只通过 CLI 导出 |
| 派生图谱被误当事实              | 所有派生输出标记 `derived_from`、`generated_at`、`tool/version`                   |
| 抽取产生幻觉关系                | 使用 confidence，默认只把 `EXTRACTED` 回写轻量索引；`INFERRED/AMBIGUOUS` 只进报告 |
| 外部工具格式变更                | adapter 层隔离，canonical JSONL 不依赖外部 schema                                 |
| 隐私泄露                        | 导出前做 redaction；secret/token/cookie/env 不进入 corpus                         |
| 派生物太大                      | 放 `.cache/entry` 或 `activity/derived`，可清理重建                               |
| 增量 cursor 错乱                | cursor 只影响派生层；可全量重建                                                   |

## 建议落地顺序

1. 定义 `foyer activity query/context/export` 的 CLI contract。
2. 明确禁止 agent 直接读 `activity/events/**/*.jsonl`。
3. 实现 `export text`：从 JSONL + inbox/project page 生成 Markdown corpus。
4. 实现本地 FTS 派生层，解决精确搜索和原文引用。
5. 做 graphify adapter：导出 corpus，运行 `graphify --update --wiki`，读取 `GRAPH_REPORT.md`。
6. 做 Hyper-Extract adapter：先用 `entry/project_timeline` 模板，支持 `parse/feed/search`。
7. 给每个派生层加 cursor、tool version、source event ids。
8. 用一个真实项目做评估：同一问题分别走 CLI context、FTS、graphify、Hyper-Extract，比较答案质量、上下文成本、可追溯性。

## 当前项目的设计判断

对 `entry-init-project` 而言，下一版目标可以补充为：

```text
存档层坚持 JSONL append-only；
大模型永不直接消费原始 JSONL；
CLI 提供查询、上下文裁剪和投影导出；
graphify 用于跨文件/跨项目图谱导航；
Hyper-Extract 用于强类型项目历史、决策、冲突和拓扑抽取；
所有抽取结果都是 derived artifacts，可重建，不作为事实源。
```

这样既保留了当前 JSONL 的科学性，也给全文处理和知识抽取留下了足够宽的接口。

## 参考资料

- [graphify GitHub](https://github.com/safishamsi/graphify)：项目说明、支持文件类型、CLI、输出文件、query/path/explain、MCP 和隐私说明。
- [graphify ARCHITECTURE.md](https://raw.githubusercontent.com/safishamsi/graphify/main/ARCHITECTURE.md)：pipeline、模块职责、抽取 schema、confidence 标签。
- [graphify validate.py](https://raw.githubusercontent.com/safishamsi/graphify/main/graphify/validate.py)：节点/边必填字段、file type 和 confidence 校验。
- [graphify export.py](https://raw.githubusercontent.com/safishamsi/graphify/main/graphify/export.py)：NetworkX node-link JSON、community、confidence score、HTML/wiki/Neo4j 等导出逻辑。
- [Hyper-Extract GitHub](https://github.com/yifanfeng97/hyper-extract)：项目说明、Auto-Types、CLI 示例、模板架构。
- [Hyper-Extract 中文 README](https://raw.githubusercontent.com/yifanfeng97/hyper-extract/main/README_ZH.md)：中文介绍、CLI 快速上手、三层架构。
- [Hyper-Extract he parse](https://raw.githubusercontent.com/yifanfeng97/hyper-extract/main/docs/en/cli/commands/parse.md)：输入、选项和输出目录结构。
- [Hyper-Extract he feed](https://raw.githubusercontent.com/yifanfeng97/hyper-extract/main/docs/en/cli/commands/feed.md)：增量更新和合并行为。
- [Hyper-Extract Saving and Loading](https://raw.githubusercontent.com/yifanfeng97/hyper-extract/main/docs/en/python/guides/saving-loading.md)：Knowledge Abstract 的 `data.json`、`metadata.json` 和 `index/` 持久化结构。
- [Hyper-Extract Auto-Types](https://raw.githubusercontent.com/yifanfeng97/hyper-extract/main/docs/en/concepts/autotypes.md)：8 种知识结构与适用场景。
