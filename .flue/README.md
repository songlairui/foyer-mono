# Flue 本地入口

当前 `.flue` 目录保持薄适配：

```bash
ENTRY_INIT_PROJECT_CLI=./dist/cli/index.js pnpm exec flue run project-init \
  --target node \
  --output .flue-dist \
  --id demo \
  --payload '{"slug":"demo-project","description":"演示项目"}'
```

如果当前环境没有 `flue` 命令，可以先使用 Node HTTP 壳验证同一个 payload 到 CLI 的路径：

```bash
tsx adapters/flue/node-http-server.ts --port 8787
```

请求：

```bash
curl -X POST http://127.0.0.1:8787/plan \
  -H 'content-type: application/json' \
  -d '{"slug":"demo-project","description":"演示项目"}'
```

真实执行必须传入 `confirm: true`。
