# Hyper-Extract — 声明式知识提取引擎

> 调研目的：理解其模板驱动提取和增量演进思想，用于 LLM 中间层分类系统设计
> 来源：https://github.com/yifanfeng97/Hyper-Extract（项目内已有 adapters/hyperextract/）
> 调研时间：2026-05-12

## 核心设计思想

**零代码提取**——通过声明式 YAML 模板定义提取规则，用户无需关注底层算法。核心理念是"配置即提取"，将知识提取问题抽象为模板 + 引擎分离的架构。

## 架构三层

```
Templates 层（域特定配置 80+）
      ↓
Methods 层（10+ 提取引擎：KG-Gen, GraphRAG, LightRAG, Hyper-RAG...）
      ↓
Auto-Types 层（8 种强类型输出）
```

## 8 种 Auto-Types（输出数据结构）

| 类型                    | 说明                             |
| ----------------------- | -------------------------------- |
| AutoModel               | 单实体模型                       |
| AutoList                | 列表型                           |
| AutoSet                 | 集合型（自动去重）               |
| AutoGraph               | 知识图谱（entities + relations） |
| AutoHypergraph          | 超图（多元关系）                 |
| AutoTemporalGraph       | 时序图                           |
| AutoSpatialGraph        | 空间图                           |
| AutoSpatioTemporalGraph | 时空图                           |

## 模板体系

80+ 预设模板，按领域组织：

```
finance/  legal/  medical/  tcm/  industrial/  general/
```

每个模板是 YAML 文件，定义：

- `fields`：字段名 + 类型 + 描述
- `guidelines`：提取规则和约束
- `identifiers`：唯一性定义（用于去重和合并）
- `display`：可视化配置

### 实体唯一性标识（关键设计）

```yaml
identifiers:
  entity_id: name # 实体以 name 为主键
  relation_id: "{source}|{type}|{target}" # 关系以三元组为主键
```

这个设计解决了"重复检测"和"幂等写入"问题。

## API

```bash
he config init    # 配置
he parse          # 解析文档
he search         # 查询知识库
he show           # 可视化
he feed           # 增量补充知识
```

```python
Template.create().parse(doc).show()
Template.create().feed(new_doc)  # 增量演进
```

## 最关键设计：增量知识融合

`feed()` 操作将新文档与现有知识图谱合并，而不是覆盖。这是演进式知识管理：

- 知识库不是快照，而是持续生长的有机体
- 新信息按 identifiers 定义的唯一性自动去重
- 相同实体的新属性自动合并到已有节点

## 可借鉴之处（分类/tag 管理）

1. **模板驱动分类**：用 YAML 模板声明"什么是合法的分类"，包括字段类型、去重规则、约束——而不是让 LLM 自由发挥

2. **强类型输出**：分类结果是有 schema 约束的结构，不是自由文本——`AutoSet` 特别适合 tag 去重

3. **唯一性标识符**：`entity_id: name` 这个设计直接解决了"两个分类是不是同一个"的判断问题——用 identifier 定义等价关系，而不是用向量距离模糊判断

4. **增量演进**：分类库随着用户行为持续进化，`feed()` 而不是 `overwrite()`

5. **引擎与模板解耦**：同一套分类模板可以用不同引擎提取（本地 LLM / GPT-4 / 图谱算法），引擎迭代不影响数据 schema

6. **80+ 模板**的存在本身就是一个设计信号：通用分类问题无法用一套规则解决，需要 **域特定模板**

## 与 Foyer 的关联

`adapters/hyperextract/` 已有集成，可将 Foyer activity 导出为 Hyper-Extract 输入格式，提取知识摘要（Knowledge Abstract）。分类系统可以复用这个通道，从 repo 活动中自动推断分类建议。
