# Honcho — Peer 范式记忆系统

> 调研目的：理解其分层存储、异步推导和 token 预算管理，用于 LLM 中间层分类系统设计
> 来源：https://github.com/plastic-labs/honcho
> 调研时间：2026-05-12

## 核心设计思想

**Peer Paradigm（对等体范式）**：用户和 AI 代理统一抽象为 "Peers"，打破传统用户-助手二元对立。系统的职责是维护每个 Peer 的**心理特征模型**（psychographic profile），让 AI 在下次交互时像"了解你的老朋友"一样响应。

## 架构三层

```
存储层（Storage） → 推理层（Reasoning，异步） → 检索层（Retrieval，多维度）
```

每层职责清晰：存储原始事实，推理层在后台处理语义，检索层按需召回。

## 数据层次结构

```
Workspace（最顶级隔离，多租户）
└── Peers（参与者实体，可以是人也可以是 AI）
    ├── Collections（文档组，可用于存储推导结论）
    │   └── Documents（向量嵌入，实际的知识单元）
    └── Sessions（交互序列，时间线上的对话）
        └── Messages（具体消息，存在 Session 或 Peer 级别）
```

**Reserved Collections**：系统内部用于存储 LLM 推导结论的保留命名空间（peer cards、trait vectors）——用户不直接写这里，只有推理层写。

## 最关键设计：异步推导管道

```
用户消息到达
    ↓
写入 Messages（同步，即时）
    ↓
触发后台任务（异步，排队）
    ├── 生成 Representation（该 session 内对 peer 的综合描述）
    ├── 生成 Session Summary（会话摘要）
    └── 更新 Peer Card（跨会话的长期特征）
    ↓
结果存入 Reserved Collections（向量嵌入）
    ↓
下次检索时可用
```

关键点：**写入是同步的，推导是异步的**——不阻塞主流程，但持续积累理解。

## 检索接口

| 接口             | 用途                                                   |
| ---------------- | ------------------------------------------------------ |
| `context` 端点   | 按 token 限制整合 messages + 结论 + 摘要               |
| `Chat API`       | 自然语言询问关于 peer 的问题（"用户偏好的学习风格？"） |
| `Search`         | 混合搜索（向量 + 关键词），支持高级过滤                |
| `Representation` | 低延迟预计算的 peer 静态快照                           |

### context 端点（核心价值）

给 LLM 返回一个**按 token 预算组织的上下文包**：

- 优先放最近消息
- 用摘要替换远期消息（节省 token）
- 附上推导出的 peer 特征

这解决了"长对话的记忆管理"问题——不是让 LLM 全量读历史，而是给它一个**经过压缩和提炼的上下文窗口**。

## 向量后端支持

- pgvector（PostgreSQL 扩展）
- turbopuffer（云原生向量存储）
- lancedb（本地向量存储）

支持混合搜索策略：向量相似度 + 关键词匹配，结合使用比单独使用任意一种都好。

## SDK

```python
import honcho

client = honcho.Honcho(...)
peer = client.peers.create(workspace_id=...)
session = client.sessions.create(peer_id=peer.id)
message = client.messages.create(session_id=session.id, content="...")

# 检索
context = client.context.get(session_id=session.id, token_limit=2000)
chat_response = client.chat(peer_id=peer.id, query="用户喜欢什么类型的内容？")
```

## 可借鉴之处（分类/tag 管理）

1. **分层存储**：分类系统也应该分层——用户意图（Messages 层）→ LLM 推导的分类（Reserved Collections 层）→ 对外暴露的分类（Representation 层），三层职责不混淆

2. **异步推导**：用户输入时不等待分类完成，异步在后台对比向量、推导合并/新建决策，完成后更新索引——写操作永远是快的

3. **token 预算管理**：`context` 端点的设计直接解决了"分类库太大 LLM 读不完"的问题——不给 LLM 全量分类，给它**按预算压缩的相关分类上下文**

4. **Chat API**（自然语言查询）：分类系统可以暴露 "告诉我 repo X 最合适的分类是什么" 这样的自然语言接口，而不是让调用方自己处理向量搜索

5. **Representation（预计算快照）**：对于高频查询（如首页加载用户分类），预计算一个静态快照，而不是每次都做实时向量搜索——低延迟的关键

6. **Workspace 隔离**：多用户场景下，每个用户的分类空间是完全隔离的，不会互相干扰——这对 Foyer 的多设备/多用户扩展很重要

7. **Peer 范式的启示**：分类本身可以是一个 "Peer"——有它自己的历史、特征、演化轨迹，而不只是一个静态的字符串标签

## 许可证

AGPL-3.0，可自托管，改进需回馈社区。Python + TypeScript SDK 均可用。
