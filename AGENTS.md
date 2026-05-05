# Agent 约束

本仓库的目标是把 `init-project` 的确定性流程下沉到 CLI/Effect 层。Agent 使用本能力时遵守以下规则：

- 使用 `pnpm` 管理依赖和脚本。
- 默认调用 `entry project init --dry-run --json` 获取计划，再根据风险决定是否执行。
- 不直接读取或 patch `~/entry/activity/events/**/*.jsonl`。
- 查询历史必须通过 `entry activity query`、`entry activity context` 或 `entry activity export`。
- 不让 LLM 持有 GitHub token、API key、cookie、`.env` 或本地 secret。
- 用户可见文档、skill 文档、Flue role、生成到 `~/entry` 的记录默认使用中文。
