# Hyper-Extract Adapter

导出输入：

```bash
entry activity export --scope project:<slug> --target hyperextract-input --json
```

导出的 Markdown 带有模板提示：

```yaml
template: entry/project_timeline
language: zh
```

本仓库提供模板在 `templates/entry/`。Hyper-Extract 输出是 derived artifact，不能反向覆盖 `activity/events/**/*.jsonl`。

在没有 `he` CLI 的环境里，可以先生成最小 Knowledge Abstract 派生物：

```bash
entry activity export --scope project:<slug> --target hyperextract-ka --json
```
