---
name: init-project
description: Pi package 入口。用 entry CLI dry-run/execute 初始化项目，不直接修改 entry JSONL。
---

# init-project

1. 提取 `slug`、`description`、`lane`、`owner`。
2. 调用 `entry project init <slug> --desc "<中文描述>" --dry-run --json`。
3. 需要远端仓库、push、覆盖或 secret 时先确认。
4. 调用 CLI 执行并返回中文摘要。
