# CLI Contract

## 稳定入口

```bash
foyer project init <slug> --desc <text> --dry-run --json
foyer project init <slug> --desc <text> --json
foyer project plan --input request.json --json
foyer project list --json
foyer inbox append --project <slug> --raw-file <path> --json
foyer project upsert-index <slug> --desc <text> --json
foyer activity append --event project.created --project <slug> --summary <text> --json
foyer activity query --project <slug> --json
foyer activity context --project <slug> --budget 6000 --format markdown
foyer activity export --scope project:<slug> --target graphify-corpus
foyer activity export --scope project:<slug> --target hyperextract-input
foyer activity export --scope project:<slug> --target hyperextract-ka
foyer repo devices --json
foyer repo status --all --json
foyer repo manifests --json
foyer doctor --json
foyer doctor --project <slug> --json
foyer search "<query>" --project <slug> --json
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
