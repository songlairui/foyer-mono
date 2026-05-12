# LLM 中间层分类管理系统 — 设计方案

> 基于 memoir / Hyper-Extract / graphify / honcho 调研，2026-05-12

## 核心命题

**人类的读写不再直接触碰落库的分类信息。** LLM 是唯一的写入者和读取代理。

传统分类：

```
人类 ←→ 分类存储
```

LLM 中间层分类：

```
人类意图 → LLM 中间层 → 分类存储（向量索引 + 图谱）
人类查询 → LLM 中间层 → 语义检索 → 结果
```

---

## 设计原则（从 4 个调研项目提炼）

| 原则                  | 来源          | 含义                                                    |
| --------------------- | ------------- | ------------------------------------------------------- |
| 语义路径层级          | Memoir        | 分类不是平铺 tag，而是 `work.coding.react` 形式的树路径 |
| 唯一性标识符          | Hyper-Extract | 每个分类有 identifier，用于精确去重，而非只靠向量距离   |
| 自底向上涌现          | Graphify      | 从使用模式中 Leiden 聚类出分类，而非只靠自顶向下定义    |
| 异步推导 + token 预算 | Honcho        | 写操作不等待分类决策，上下文按预算压缩，不全量读        |

---

## 架构三层

```
┌──────────────────────────────────────────┐
│  Layer 1 · Intent Layer                  │
│  用户以自然语言表达意图（"这是 React 项目"）  │
└──────────────────┬───────────────────────┘
                   ↓ 异步/流式
┌──────────────────────────────────────────┐
│  Layer 2 · LLM Middleware                │
│  · 向量近邻查询（top-K 候选分类）           │
│  · 合并/新建/别名 决策                     │
│  · token 预算管理（Category Summary）      │
│  · 异步后台推导（不阻塞主流程）              │
└──────────────────┬───────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│  Layer 3 · Store Layer                   │
│  · HNSW 向量索引（分类嵌入）               │
│  · 图谱（分类关系：父子、共现、语义邻近）    │
│  · 元数据 KV 存储                          │
│  · Category Summary 快照（定期刷新）       │
└──────────────────────────────────────────┘
```

---

## 数据模型

### Category（分类节点）

```typescript
type Category = {
  id: string; // 语义路径，如 "work.coding.react"
  label: string; // 人类可读名称，如 "React 项目"
  description: string; // LLM 根据使用模式自动生成的摘要
  embedding: float[]; // 向量表示（由 label + description 生成）
  parent?: string; // 父路径，如 "work.coding"
  children: string[]; // 子路径列表
  aliases: string[]; // 别名（用于近邻去重）
  created: datetime;
  usage_count: number;
  last_used: datetime;
  confidence: number; // 该分类的"稳定性"，新建时低，多次使用后升高
};
```

### CategoryAssignment（归类记录）

```typescript
type CategoryAssignment = {
  item_id: string; // 被分类的对象 ID（repo path、entry ID...）
  category_id: string;
  confidence: number; // 0-1，LLM 的置信度
  assigned_by: "user" | "llm" | "cluster"; // 来源
  rationale?: string; // LLM 的分类理由（可审计）
  created: datetime;
};
```

### CategorySummary（LLM 上下文快照）

```markdown
# Category Summary（定期由 LLM 从索引生成）

## God Categories（使用最频繁的核心分类）

- work.coding (82 items) — 编程和开发相关
- learning (45 items) — 学习资料和课程
- ...

## Recent（最近 7 天新增或使用的分类）

- work.coding.react (新建 3 天前)
- ...

## Near-Duplicate Warnings（向量距离 < 0.2 的分类对，待合并）

- "work.frontend" ↔ "work.coding.frontend" (cos=0.12)
```

---

## 写入流程（分类一个 repo）

```
用户输入: "这个放到 React 实验项目里"
                ↓
1. LLM 提取意图关键词: ["React", "实验", "前端"]
                ↓
2. 向量搜索 top-5 候选（从 HNSW 索引，不全量读）:
   - work.coding.react (cos_sim=0.91)
   - work.coding.frontend (cos_sim=0.78)
   - learning.react (cos_sim=0.65)
   - ...
                ↓
3. LLM 判断: cos_sim=0.91 > 阈值 0.7，触发追问

   LLM: "我找到了 'React 项目 (work.coding.react)'，与你说的很接近。
         直接用这个，还是新建一个更具体的子分类？"
                ↓
4A. 用户说"复用"→ 写入 CategoryAssignment，结束
4B. 用户说"新建"→ 进入新建流程
                ↓
5. 新建流程:
   LLM 提议: "work.coding.react.experiments"
   检查: cos_sim 与所有 work.coding.react.* 子分类 < 0.3 ✓
   写入 Category + CategoryAssignment
                ↓
6. 后台异步: 更新 Category Summary 快照（Leiden 重聚类）
```

### 核心决策规则

| 场景     | 条件                 | 行为                                            |
| -------- | -------------------- | ----------------------------------------------- |
| 高度匹配 | cos_sim ≥ 0.85       | 追问是否复用                                    |
| 中度匹配 | 0.5 ≤ cos_sim < 0.85 | 展示候选列表，让用户选择或新建                  |
| 无匹配   | cos_sim < 0.5        | 直接新建，LLM 自动构造语义路径                  |
| 强制新建 | 用户拒绝复用         | 新建，但 cos_sim 接近时附加 Near-Duplicate 警告 |

---

## 读取流程（查找分类）

### 场景 1：用户查询

```
用户: "显示我所有 React 相关的"
       ↓
LLM: 语义向量化查询
       ↓
HNSW 搜索 top-20
       ↓
返回: [work.coding.react, work.coding.react.experiments, learning.react]
       ↓
汇总各分类下的 items，按 usage_count 排序
```

### 场景 2：LLM 分类上下文请求（token 预算模式，from Honcho）

```
LLM 中间层需要做分类决策，请求上下文包（预算: 2000 tokens）
       ↓
Context 端点返回:
  - Category Summary 快照（God nodes + Recent，~400 tokens）
  - 向量搜索结果 top-5（~300 tokens）
  - 该 item 的历史分类（~100 tokens）
  共 ~800 tokens，留足 1200 tokens 给 LLM 推理
```

---

## "无限增长"问题的解法

这是用户提到的核心难点。从 4 个工具中综合出三道防线：

### 防线 1：Category Summary 快照（from Graphify GRAPH_REPORT + Honcho Representation）

维护一个定期刷新的 `category-summary.md` 文件：

- **不随分类数量增长而变大**，始终只有固定条目（God nodes + Recent + Warnings）
- LLM 分类决策时先读 Summary，再做针对性向量搜索
- 分类库有 10 个还是 10000 个，LLM 的 token 消耗不变

### 防线 2：语义路径限定搜索空间（from Memoir）

分类 `work.coding.react` 要新建子分类时，只在 `work.coding.react.*` 命名空间内做向量搜索，而不是全库搜索——搜索空间从 O(N) 降到 O(子树大小)。

### 防线 3：Leiden 周期性重聚类（from Graphify）

定期（每周/每月）对全部分类做 Leiden 聚类，自动识别：

- 可以合并的相似分类（Too close）
- 应该拆分的过大分类（Too many items）
- God nodes（最核心的分类，应在 Summary 中高亮）

聚类结果作为建议，推送给用户确认，而不是自动修改——保持人类对最终结构的控制权。

---

## 分类演化（从 Hyper-Extract feed() 借鉴）

分类不是静态的，有生命周期：

```
新建 (confidence=0.3)
  ↓ 多次使用后
稳定 (confidence=0.9)
  ↓ 长期不用或 Leiden 检测到重叠
演化建议 (待确认)：
  ├── 合并: A + B → A（B 的 assignments 迁移到 A，B 成为 A 的 alias）
  ├── 拆分: A → A1 + A2（按 clustering 自动建议边界）
  └── 归档: A → archived.A（usage_count=0，保留历史 assignments）
```

所有演化操作都经过 LLM 提议 → 用户确认，不自动静默修改。

---

## 与 Foyer 现有分类系统的关系

当前 Foyer 分类（`docs/features/分类管理.md`）是基础层，可以渐进迁移：

| 现有设计                        | LLM 中间层升级路径                       |
| ------------------------------- | ---------------------------------------- |
| `CategoryDef[]` in localStorage | 迁移到 Store Layer，附加 embedding 字段  |
| 人工增删分类                    | 经 LLM 中间层，触发向量近邻检查后写入    |
| 固定 8 色 + 图标                | 保留（仍由人工选择视觉属性）             |
| `readAllTags()` 直接读          | 改为 LLM 语义查询代理，返回语义相关分类  |
| `TagManageDialog` 直接写        | 改为意图输入框，LLM 转义为 Category 操作 |

---

## 技术选型建议

| 组件     | 选项                                       | 推荐                                |
| -------- | ------------------------------------------ | ----------------------------------- |
| 向量索引 | HNSW (hnswlib) / pgvector / lancedb        | lancedb（本地优先，支持 WASM）      |
| 嵌入模型 | OpenAI text-embedding-3-small / local ONNX | 轻量 local model（避免网络依赖）    |
| 图存储   | graph.json（参考 Graphify）/ Neo4j         | 单文件 JSON，够用且可 git 追踪      |
| 后台任务 | 异步任务队列（参考 Honcho）                | Web Worker / Bun background job     |
| LLM      | claude-haiku-4-5（低成本高频调用）         | Haiku（符合分类这类中等复杂度任务） |

---

## 最小可行实现（MVP）

按优先级排列的最小验证路径：

1. **写入拦截**：`TagManageDialog` 新增 "智能分类" 入口，输入自然语言 → 向量搜索现有分类 → 展示候选 → 确认写入
2. **向量索引**：给现有 `CategoryDef[]` 批量生成 embedding，存入 lancedb
3. **Category Summary**：每次分类变更后，重新生成 `category-summary.md`（静态 JSON/MD 文件，供 LLM 读取）
4. **追问流程**：cos_sim > 0.7 时触发追问弹层
5. **Leiden 聚类（可选第二期）**：周期性运行，生成合并/拆分建议

---

## 延伸：分类系统作为基础设施

一旦分类系统有了 LLM 中间层，它可以对外暴露为服务：

```typescript
// MCP tool: classify
{
  name: "classify_item",
  description: "给一个 item 找到最合适的分类，或建议新建分类",
  input: { item_description: string, hint?: string }
}

// MCP tool: find_categories
{
  name: "find_categories",
  description: "语义搜索相关分类",
  input: { query: string, limit?: number }
}
```

其他 agent（init-project、inbox skill 等）可以调用分类系统，而不是自己管理标签逻辑——分类成为全局基础设施，而不是 Foyer UI 的专属功能。
