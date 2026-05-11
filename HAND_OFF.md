# HAND_OFF

> 生成时间：2026-05-11 13:00

## 目标

为 foyer 添加 git worktree 检测（CLI）与展示（Web UI），包括 repo 卡片点击后的抛物线飞行动画 + 3D 翻转卡片展示 worktree 列表。

## 当前状态

CLI 侧已提交；Web UI 侧 3D flip 动画已修复根因（`transform-style: preserve-3d` 链条），但未在浏览器中验证。flying 动画用的是 Web Animations API，可能存在与 React 渲染的竞态。

## 已完成

- CLI: `foyer repo devices --with-worktrees` + `foyer repo worktrees --path` (commit `17cab89`)
- CLI: `RepoWorktree` 类型、`git worktree list --porcelain` 解析、Effect 批量检测
- Web UI: oRPC devices router 传 `--with-worktrees`、透传 worktree 数据
- Web UI: RepoCard 上 GitBranch 图标 badge + DropdownMenu 快捷打开 worktree 分支
- Web UI: RepoDetailModal 抛物线飞行（Web Animations API, 6 关键帧, 680ms）
- Web UI: 3D flip 结构（perspective + preserve-3d + backface-visibility）

## 待完成

- **在浏览器验证 3D flip 效果** — 已修复 `transform-style: preserve-3d` 在 `flyRef` 上缺失的问题，但未实际测试
- 飞行结束后卡片宽度从 `sourceRect.width` 过渡到 `380px` 的动画可能需要调整
- 飞行期间按 ESC 的行为未处理（phase === "fly-in" 时直接忽略）

## 关键决策

- Worktree 检测走 Effect.Shell 而非 fs（`git worktree list --porcelain` 是唯一可靠方式）
- 飞行动画用 Web Animations API 而非 CSS @keyframes：需要动态计算抛物线起止点（sx/sy → cx/cy），CSS keyframes 无法动态传参
- 飞行结束后用 `commitStyles()` + `cancel()` 清除动画 fill，再显式写 inline style，避免动画样式（cascade layer 4）覆盖 CSS transition（layer 8）
- 3D flip 需要完整 `preserve-3d` 链条：flyRef → inner div → front/back faces，缺任一环节 3D 渲染都会被压平为 2D

## 踩坑记录

- 飞行动画 fill: "forwards" 在 cascade 中优先级高于普通 inline style，会导致后续 CSS transition 不生效 → 必须在 `onfinish` 中 cancel 动画并重写 style
- `transition` 条件式设置（`flipped ? "transform ..." : "none"`）导致翻回去时 transition 先变 none 再变 transform，无动画 → 改为始终设置 transition
- `perspective` 必须设在有 `preserve-3d` 的祖先元素上，否则透视无效，翻转只表现为 2D 缩放

## 下一步

1. 在浏览器中打开 web-ui，点击一个 repo 卡片验证：
   a. 抛物线飞行 + 360° Y 轴旋转是否流畅
   b. 点击 Worktree 按钮，卡片是否以 3D 透视效果翻转到背面
   c. 点击背面 ← 按钮，是否以 3D 效果翻回正面
2. 如果 3D flip 仍然不工作：检查 `flyRef` 的 `perspective` / `transformStyle` 是否被 React 渲染覆盖
3. 如果飞行结束后卡片位置偏移：检查 `anim.commitStyles()` 是否在 `cancel()` 之前执行

## 关键文件

- `packages/cli/src/workflows/repo.ts` — worktree 检测核心（parseWorktreeList, enrichDevicesWithWorktrees, repoWorktreesByPath）
- `packages/cli/src/cli/index.ts` — `--with-worktrees` flag + `repo worktrees` 命令
- `apps/web-ui/src/components/home/RepoDetailModal.tsx` — 抛物线飞行 + 3D flip modal（约 420 行，核心动画逻辑在 40-110 行）
- `apps/web-ui/src/components/home/RepoCard.tsx` — worktree 图标 badge + DropdownMenu + sourceRect 捕获
- `apps/web-ui/src/orpc/router/devices.ts` — oRPC router，传 `--with-worktrees`
