# Inbox Skill 设计全貌

## 当前方案：提示词自主触发（已实施）

通过 skill description + 自主触发指南，让 LLM 在合适的时机**主动调用** inbox，无需用户显式说「inbox」。

### 机制

- **前端**：skill 的 `description` 字段（出现在 AGENTS.md 的 `<available_skills>` 中）声明了自主触发条件
- **细则**：SKILL.md 正文的「## 自主触发」章节给出了明确的触发/不触发场景
- **安全网**：inbox 内部的三档意图分级（碎碎念/探索型/明确执行型）保证了即使 LLM 过度触发，也不会在碎碎念上浪费算力

### 触发判断由 LLM 完成

- 优点：零基础设施，即时生效
- 缺点：依赖 LLM 判断的一致性，可能漏判或误判

---

## 未来方案：外部 flue 服务（规划中）

### 目标

每个 user prompt 统一走外部评判服务，判断是否 inbox-worthy，数据落盘到外部，不侵入当前对话上下文。

### 架构

```
user types → pi input event → flue agent (HTTP) → classification
  ├─ inbox-worthy → transform input 为 "inbox <原文>" → agent 正常回复
  └─ normal chat → 原样 pass through → agent 正常回复
```

### pi 侧落点

- **事件**：`input` event（唯一能在 agent 启动前拦截并改写 prompt 的钩子）
- **扩展形态**：pi extension（`~/.pi/agent/extensions/inbox-gate.ts`）
- **核心逻辑**：
  1. 拦截 `input` 事件
  2. 发送 prompt 到 flue 服务
  3. 根据返回的 classification 决定 transform 或 pass through

### flue 侧

- **分类器**：二分类——「值得进 inbox」vs「普通对话」
- **部署**：本地 HTTP 服务（`adapters/flue/node-http-server.ts` 已有骨架）
- **模型**：可从小模型（本地推理）到大模型（远程 API），按延迟预算选择

### 关键设计决策（待定）

| 维度     | 选项 A                                        | 选项 B                                          |
| -------- | --------------------------------------------- | ----------------------------------------------- |
| 时机     | 事前拦截（`input` 事件）                      | 事后捕获（`agent_end` 事件）                    |
| 分类精度 | 简单二分类（yes/no），后续由 inbox skill 处理 | 完整分类（type/title/tags/档位），减少 LLM 轮数 |
| 延迟预算 | 本地小模型，<500ms                            | 远程 API，1-3s                                  |
| 作用域   | 仅 foyer-mono 项目                            | 全局 pi extension，所有项目可用                 |

### 与当前方案的关系

当前提示词方案是**低点**——改一行 description 就生效，适合快速验证触发逻辑。
待验证稳定后，flue 方案作为**高点**接手，提供更确定性的分类。

---

## 讨论过的方案（记录）

### 方案 A：粗暴型——每个输出自动加 inbox

- pi 落点：`agent_end` 事件后 `sendUserMessage("inbox ...")`
- 废弃原因：噪音太大，正常对话也被捕获

### 方案 B：系统提示注入——`before_agent_start` 修改 system prompt

- pi 落点：extension 在 `before_agent_start` 中追加 inbox 判断指南
- 废弃原因：比直接改 skill description 更重，且 skill description 本身就是为此设计的

### 方案 C：外部 flue 服务（即未来方案）

- 保留为未来方向

---

## 相关文件

- `skills/inbox/SKILL.md` — skill 定义（源头）
- `.agents/skills/inbox/SKILL.md` — 项目内 pi 加载的副本
- `~/.agents/skills/inbox/` — 全局同步目标（`./sync-skills.sh`）
- `adapters/flue/` — flue 适配骨架
- `_inbox/` — 运行时数据目录
