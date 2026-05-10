<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Agent 开发规则

本仓库是开发，迭代，优化 `init-project` 技能的源仓库

已经将raw 节能的确定性流程下沉到 CLI/Effect 层。修改本仓库时遵守以下规则：

- 使用 Vite+ 管理 monorepo 开发入口；依赖安装仍通过 `vp install` 委托 pnpm。
- 确定性流程放在 `packages/cli/src/workflows` 和 `packages/cli/src/cli`，宿主 adapter 只做分发和调用。
- 涉及 entry 历史数据的验证使用临时 `--entry-root`，不要直接改真实 `~/entry`。
- 不直接 patch `activity/events/**/*.jsonl`；新增写入路径必须走 CLI/workflow。
- 不提交 `dist/`、`.flue-dist/`、`node_modules/`、`.env*` 或本地 secret。
- 提交前至少运行 `vp check` 和 `vp test`；涉及 CLI 构建时运行 `vp run build`。
- 新增用户可见仓库文档默认使用中文；代码标识符、命令名、schema 字段可以保留英文。
