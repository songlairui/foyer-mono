# Flue 适配说明

根目录 `.flue/` 是薄适配壳：

- `.flue/agents/project-init.ts` 接收结构化 payload。
- `.flue/roles/project-planner.md` 规定 LLM 只做意图抽取和确认。
- 实际执行通过 `foyer project init --dry-run --json` 和 `foyer project init --json`。
- `pnpm exec flue run project-init --target node --output .flue-dist --id <id> --payload <json>` 可作为 Flue CLI 触发入口。

如果未来接入真实 `flue run`、Node HTTP endpoint 或远端部署，仍应保持核心 workflow 在 `src/workflows`。
