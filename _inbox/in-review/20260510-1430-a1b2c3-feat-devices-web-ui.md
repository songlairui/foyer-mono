---
id: 20260510-1430-a1b2c3
title: devices 数据 Web 可视化界面
type: feat
tags: [cli, workspace, web]
created: 2026-05-10T14:30:00+08:00
updated: 2026-05-10T15:30:00+08:00
status: in-review
started: 2026-05-10T14:30:00+08:00
reviewed_at: 2026-05-10T15:30:00+08:00
intent_root: 快速一览本机所有 repo 的分布，并能直接从浏览器打开项目
---

## 起意

`foyer repo devices --all-roots --json` 能拿到完整的 repo 列表（131 个，4 个 scanRoot），但命令行输出不便于快速浏览全局。需要一个可以在浏览器里打开的 web UI，在宽屏下舒适浏览，并且能直接点击打开项目。

## 决定

- 单个自包含 HTML 文件，数据内嵌，零依赖，直接在浏览器打开
- 输出位置：`packages/cli/tui/devices-preview.html`
- 3200x1350 viewport 适配：auto-fill 多列卡片网格，左侧导航锚定 scanRoot 分组
- 深色主题，简洁现代风格
- 每张卡片：repo 名称（等宽字体）+ 相对路径 + 点击次数 badge（右上角）
- 搜索框实时过滤，`/` 快捷聚焦，`Esc` 清空
- 点击卡片：通过 foyer local-agent 服务打开对应项目目录，带 toast 反馈

## 实施摘要

### v1（首版）

- 4 个 scanRoot 分组，131 个 repo 卡片
- 左侧导航 + 滚动 spy + 计数 badge
- 实时搜索过滤

### v2（本次更新）

- **localStorage 点击计数**：`foyer.repo.click.{path}` → 整数，卡片右上角紫色 badge
- **点击打开**：调用 `http://127.0.0.1:7070/open?path=PATH`
- **Agent 状态指示器**：header 右侧绿/灰脉冲点，运行时展示配置的 opener
- **离线降级**：agent 未启动时 toast 提示 `foyer agent start`

## TODO

- [x] 创建 `packages/cli/tui/devices-preview.html`
- [x] 嵌入真实数据
- [x] 左侧 root 导航 + 滚动 spy
- [x] 搜索过滤
- [x] localStorage 点击计数 badge
- [x] 点击打开（调用 foyer local-agent）
- [x] agent 状态指示器（header 右侧）
- [x] toast 反馈（成功/错误）
