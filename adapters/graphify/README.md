# graphify Adapter

导出 corpus：

```bash
entry activity export --scope project:<slug> --target graphify-corpus --json
```

然后在导出的 `corpus` 目录上运行当前 graphify CLI：

```bash
graphify update <corpus>
```

`graphify-out/` 是 derived artifact，可删除重建。它不能回写为 entry 事实源。
