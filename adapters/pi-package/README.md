# Pi Package / Extension 调研结论

当前暂无必要把 `foyer-mono` 做成 Pi package 或 extension。

原因：

- 当前核心需求是稳定创建项目和记录 Foyer 历史，CLI + skill 已能覆盖。
- Pi extension 适合注册命令、事件拦截、UI、动态上下文或 provider；这些现在还没有形成刚需。
- extension 具备更高系统权限，过早引入会增加审查和维护成本。

当前建议：

```text
自然语言请求 -> init-project skill -> foyer CLI
```

本目录保留为调研样例。只有当出现明确 Pi 专属需求时再推进，例如自定义命令面板、危险 tool call 拦截、当前 Foyer/device 状态注入或 UI dashboard。
