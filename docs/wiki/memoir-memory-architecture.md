# Memoir — Git for AI Memory

> 调研目的：理解其分类/路径管理思想，用于 LLM 中间层分类系统设计
> 来源：https://github.com/zhangfengcdt/memoir
> 调研时间：2026-05-12

## 核心设计思想

Memoir 的口号是 **"Git for AI Memory"**——将版本控制系统的设计哲学完整移植到 AI 智能体的记忆管理中。

### 三个痛点

| 痛点       | 描述                                                      |
| ---------- | --------------------------------------------------------- |
| 上下文污染 | 无分支感知的记忆导致跨 git checkout 时应用过时规则        |
| Token 成本 | 全局 MEMORY.md 每次更新破坏前缀缓存，强制重新处理整个对话 |
| 记忆漂移   | 无版本控制的追加式存储，一次错误会话污染所有未来检索      |

### 架构分层

```
存储层 → 分类层 (Classifier) → 搜索层 → 聚合层
```

- **存储层**：持久化 + 版本控制后端（文件系统/数据库）
- **分类层**：自动或手动将信息映射到语义路径
- **搜索层**：关键词引擎 + LLM 驱动引擎并存
- **聚合层**：自动合并同一语义位置的相关记忆

## 最关键设计：语义路径

用 **语义路径** 替代 UUID 键：

```
profile.professional.skills.python
profile.personal.preferences.communication
project.foyer.decisions.auth-approach
```

路径特性：

- O(log n) 层级查找
- 人类可读，可审计
- 天然支持命名空间隔离
- 路径本身即语义索引

## API 设计

```bash
memoir remember "content" [-p path]    # 存储，-p 指定或自动推断路径
memoir get <path>                      # 按路径精确读取
memoir recall "query"                  # 语义模糊搜索
memoir blame <path>                    # 查看记忆来源（类 git blame）
memoir ui                              # 可视化浏览
```

## 分类治理模式

| 模式     | 描述                                       |
| -------- | ------------------------------------------ |
| 显式分类 | 用户手动指定 `-p preferences.coding.style` |
| 隐式分类 | LLM 自动推断语义位置（需 API 调用）        |
| 记忆聚合 | 同语义路径的记忆自动整合                   |
| 分支感知 | 每个 git 分支独立记忆视图                  |
| 审计追踪 | blame 查看记忆变更历史                     |

## 可借鉴之处（分类/tag 管理）

1. **语义路径层级**：分类不是平铺的 tag list，而是有层次的路径树——`work.coding.react` vs `work.coding.vue` 距离更近，路径本身就是语义关系的编码

2. **LLM 推断 + 人工覆写**：默认让 LLM 决定分类路径，人类只在不满意时覆写，而不是反过来

3. **版本控制**：分类本身可以被版本化——支持回滚"我上周对这个 repo 的分类"

4. **聚合而非追加**：同一路径的多次写入自动合并，避免分类碎片化

5. **审计可追溯**：每次分类决策都有记录，LLM 的"为什么这样分"可查

## 技术栈

Python 68% + TypeScript 15.6%（UI），模块化架构，支持多 LLM 后端（claude-haiku-4-5 / gpt-4o-mini）。
