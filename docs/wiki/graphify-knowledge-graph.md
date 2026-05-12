# Graphify — 代码库知识图谱

> 调研目的：理解其图结构建模和社区检测思想，用于 LLM 中间层分类系统设计
> 来源：https://github.com/safishamsi/graphify
> 调研时间：2026-05-12

## 核心设计思想

**"构建一次，查询多次"**——将代码库、文档、图像、视频转化为可查询的知识图谱，让 AI 编码助手通过图结构而非逐文件搜索来理解项目。

核心口号：AI 助手在回答代码问题前自动读取图谱摘要，而不是搜索文件。

## 架构

```
输入（代码/文档/视频/PDF）
      ↓
提取层（tree-sitter AST + LLM 语义）
      ↓
图构建层（节点 + 边 + 元数据）
      ↓
聚类层（Leiden 算法社区检测）
      ↓
输出（graph.html / GRAPH_REPORT.md / graph.json）
```

## 图结构设计

### 节点类型

- 代码实体：函数、类、模块
- 设计文档：README、注释块
- 内联注释萃取：NOTE / WHY / HACK 类型
- 多模态内容：视频转录、PDF 语义、图像 OCR

### 边类型

- 调用关系、继承关系、导入关系（确定性）
- 语义相似性（LLM 推断，标记为 `INFERRED`）

### 置信度元数据

```
EXTRACTED  → 直接从代码提取，确定性高
INFERRED   → LLM 推断，中等置信度
AMBIGUOUS  → 模糊关系，低置信度
```

## 最关键设计：Leiden 聚类

使用 **Leiden 算法**（Louvain 的改进版）进行社区检测，自动识别：

- **God nodes**：最高连通性的概念节点（跨模块枢纽）
- **惊人连接**：跨模块的高度关联（按异常度排序）

输出的 `GRAPH_REPORT.md` 按三级结构组织：

```
God nodes → Surprising connections → 具体代码细节
```

这是一种**自动发现分类结构**的方法——不是人工定义类别，而是从连接模式中涌现出来。

## MCP 服务器

```python
python -m graphify.serve graphify-out/graph.json
```

提供 4 个 MCP 工具：

- `query_graph`：语义查询
- `get_node`：节点详情
- `get_neighbors`：邻居节点
- `shortest_path`：最短路径查询

## 存储格式

```
graph.json    # 完整图数据（可提交到 git）
graph.html    # 可视化（交互式）
GRAPH_REPORT.md  # 要点摘要（供 LLM 读取）
```

**自动冲突合并**：两个开发者并行提交时，`graph.json` 自动取并集，无冲突标记。

## 增量更新机制

```bash
graphify --update   # 仅重新提取变更文件
graphify --watch    # 监听文件变化实时更新
```

Git hook：提交后自动重建图谱（仅 AST 部分，无 API 成本）。

## 全局图谱

```bash
graphify global add <project>    # 添加到全局
graphify global list             # 列出所有
```

多项目的 `graph.json` 取并集，形成跨项目的知识网络——可以跨仓库查询语义关联。

## 可借鉴之处（分类/tag 管理）

1. **Leiden 社区检测**：不让人或 LLM 手动定义分类边界，而是从数据连接模式中**自动涌现**出分类——这是最激进也最有趣的思路，用户的行为模式会自然聚类成分类

2. **God nodes 概念**：某些分类会自然成为高连接度的枢纽节点（如"工作"、"学习"），系统应识别并优先展示这些核心分类

3. **置信度分层**：分类关系不是二元的，而是有置信度——"这个 repo 可能属于 A"和"这个 repo 确定属于 B"需要区分

4. **GRAPH_REPORT.md**：这个设计值得借鉴——给 LLM 一个**摘要入口**，而不是每次都全量读图。分类系统的 LLM 中间层可以维护一个"Category Summary"文件，定期从向量索引生成，避免全量 scan

5. **分叉合并语义**：分类冲突时自动取并集，而不是报错——宽容的合并策略比严格的冲突检测更适合分类这个模糊问题

6. **MCP 接口**：分类系统暴露为 MCP 服务，其他 agent 可以查询"离 X 最近的分类是什么"——这让分类系统成为基础设施而非孤立功能

## 与当前 Foyer 分类的对比

当前 Foyer 分类：静态定义、localStorage 存储、人工维护
Graphify 思路：动态图谱、自动聚类、连接驱动的分类涌现

最大的不同：Foyer 分类是**自顶向下**的（先定义分类，再归类），Graphify 是**自底向上**的（先观察连接，再发现分类）。
