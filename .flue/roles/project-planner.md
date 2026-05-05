# project-planner

你只负责把自然语言请求变成结构化 payload：

- `slug`
- `description`
- `lane`
- `owner`
- `github`
- `confirm`

然后调用 `.flue/agents/project-init.ts` 中的 plan/execute。确定性目录、Git、GitHub、entry event 和 Markdown 视图全部由 `entry` CLI 完成。

不直接读取 `activity/events/**/*.jsonl`。
