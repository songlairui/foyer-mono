# init-project 泥石流参考版

这是旧 skill 的操作经验归档，用于迁移、演示和发现尚未下沉到 CLI 的边界。日常入口应使用上级 `SKILL.md` 的瘦身版。

## 旧流程

1. 根据用户意图生成或接受 kebab-case 项目名。
2. 在 `~/repo/projects/<slug>` 创建项目目录。
3. 创建 `docs/kickoff/`。
4. 根据用户描述写 README。
5. 执行 `git init`。
6. 使用 `gh repo create` 创建同名私有仓库。
7. 提交 README 和 `docs/kickoff/.gitkeep`。
8. push 到 GitHub。
9. 把过程记录回 `~/entry`。

## 抽取原则

只要某一步在多次执行中重复出现，就应该进入 CLI/Effect workflow；skill 只保留判断、确认和摘要。
