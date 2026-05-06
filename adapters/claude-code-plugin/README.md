# Claude Code Plugin 调研结论

当前暂无必要把 `entry-init-project` 做成 Claude Code plugin。

原因：

- 关键负担是“接管新建项目目录组织的心理负担”，不是缺少 Claude 专属 UI 或 hook。
- 已有 `foyer` CLI 能提供稳定 JSON、dry-run、错误码和 doctor/dashboard。
- 瘦身版 `skills/init-project/SKILL.md` 已足够承接自然语言意图、确认计划和调用 CLI。
- 过早维护 plugin 会增加分发、权限、hooks 和命名空间成本，但不会明显改善当前工作流。

当前建议：

```text
自然语言请求 -> init-project skill -> foyer CLI
```

本目录保留为调研样例和未来边界记录。只有当出现明确 Claude Code 专属需求时再推进，例如团队分发、安装校验、统一 hook、MCP/LSP 集成或安全策略注入。
