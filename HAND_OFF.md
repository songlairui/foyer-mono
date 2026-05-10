# HAND_OFF

> 生成时间：2026-05-10 21:30

## 目标
为 foyer 项目构建 Web UI Dashboard，展示 `foyer repo devices --all-roots --json` 返回的 repo 列表，支持分类标记、拖拽分组、美观的暗色主题，适配 3200x1350 宽屏。

## 当前状态
拖拽功能存在两个 bug 未修复，已改了一半的代码未提交；右侧分组标题 sticky 和 ScrollArea 改动也未验证。

## 已完成
- 整体布局：60% 左侧分类面板 + 40% 右侧 repo 列表
- 暗色主题、repo 描述、最后修改时间显示
- 分类标记系统（Goal/Work/Life/Explore + 工作子方向）
- 拖拽系统基础架构（dnd-kit: Draggable + Droppable + Sortable）
- 路径显示从 ~/ 开始而非 /Users/...
- 下拉菜单添加标记功能
- DragOverlay 卡片样式

## 待完成
- **右侧 repo 卡片无法拖拽** — 用户反馈拖拽不动，当前尝试将拖拽覆盖层从 `inset-0` 改为 `bottom-10`（只覆盖卡片上半部分），但未验证
- **左侧拖拽触发右侧卡片拖拽** — 同一 repo 出现在左侧和右侧时 id 冲突，已添加 `sortable-` 前缀给左侧 SortableRepoCard，但未验证效果
- **右侧分组标题 sticky** — 已改为 `sticky top-0 bg-card/90 backdrop-blur-md z-50`，但 sticky 在 ScrollArea 内可能不生效（ScrollArea 的 viewport 需要 `position: relative`）
- **右侧滚动条样式** — 已将 `<div overflow-auto>` 改为 `<ScrollArea>`，需确认 ScrollArea 组件已正确引入 shadcn/ui

## 关键决策
- 同一 repo 左右两侧共享 `repo.path` 做拖拽 id → 导致 id 冲突 → 改为左侧 SortableRepoCard 使用 `sortable-${path}` 前缀
- 拖拽覆盖层 `bottom-10` 而非 `inset-0` → 让底部按钮（"打开"、下拉菜单）可点击，但会影响底部区域拖拽

## 踩坑记录
- SSR 场景下 `document` 不存在 → FullscreenButton 必须在 useEffect 内访问 document
- 浏览器拖拽时触发文本选择 → 需要 `select-none` + `onMouseDown/onTouchStart preventDefault`
- dnd-kit 的 useDraggable 与按钮点击冲突 → 拖拽层 z-10 覆盖了按钮 z-20，按钮不是被遮挡而是拖拽事件先被捕获
- 同一 repo 左右两侧复用相同 id → DndContext 认为是同一个 draggable，拖左侧触发右侧的拖拽
- ScrollArea 组件的 sticky 子元素需要 ScrollArea 的 viewport 有 `position: relative`，否则 sticky 不生效

## 下一步
1. 修复右侧拖拽：验证 `bottom-10` 覆盖层方案是否可行，或改用 GripVertical 手柄作为唯一拖拽触发点
2. 验证左侧 sortable 前缀是否解决了 id 冲突
3. 验证 ScrollArea 内 sticky 标题是否生效，若不生效需给 ScrollArea 的 viewport 加 `position: relative`
4. 提交这批修改（4 个文件）

## 关键文件
- `apps/web-ui/src/routes/index.tsx` — 主页面，DndContext + 布局 + 拖拽逻辑
- `apps/web-ui/src/components/home/DraggableRepoCard.tsx` — 右侧可拖拽卡片，当前覆盖层改动未验证
- `apps/web-ui/src/components/home/SortableRepoCard.tsx` — 左侧可排序卡片，sortable- 前缀改动未验证
- `apps/web-ui/src/components/home/RepoCard.tsx` — 卡片 UI 组件
- `apps/web-ui/src/components/home/CategoryPane.tsx` — 左侧分类面板，droppable 容器