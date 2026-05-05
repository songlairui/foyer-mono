# CLI Contract

## 稳定入口

```bash
entry project init <slug> --desc <text> --dry-run --json
entry project init <slug> --desc <text> --json
entry project plan --input request.json --json
entry inbox append --project <slug> --raw-file <path> --json
entry project upsert-index <slug> --desc <text> --json
entry activity append --event project.created --project <slug> --summary <text> --json
entry activity query --project <slug> --json
entry activity context --project <slug> --budget 6000 --format markdown
entry activity export --scope project:<slug> --target graphify-corpus
entry activity export --scope project:<slug> --target hyperextract-input
entry activity export --scope project:<slug> --target hyperextract-ka
entry repo devices --json
entry repo status --all --json
entry repo manifests --json
entry doctor --json
entry doctor --project <slug> --json
entry search "<query>" --project <slug> --json
```

## 输出规则

- `--json` 时 stdout 只输出 JSON。
- 错误 JSON 使用 `{ ok: false, error: { code, messageZh, recoverable, details } }`。
- 人类诊断走 stderr。
- dry-run 不产生副作用。

## 业务错误

- `DIRECTORY_ALREADY_EXISTS`
- `ENTRY_TARGET_MISSING`
- `GH_UNAVAILABLE`
- `GIT_UNAVAILABLE`
- `REMOTE_REPO_EXISTS`
- `NETWORK_FAILURE`
- `ENTRY_WRITE_CONFLICT`

这些错误都应能被 agent 解释为可恢复状态，而不是继续猜测。
