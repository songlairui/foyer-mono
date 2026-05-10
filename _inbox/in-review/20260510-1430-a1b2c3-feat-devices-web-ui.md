---
id: 20260510-1430-a1b2c3
title: devices 数据 Web 可视化界面
type: feat
tags: [cli, workspace, web]
created: 2026-05-10T14:30:00+08:00
updated: 2026-05-10T14:30:00+08:00
status: in-review
started: 2026-05-10T14:30:00+08:00
intent_root: 快速一览本机所有 repo 的分布，方便日常导航和管理
---

## 起意

`foyer repo devices --all-roots --json` 能拿到完整的 repo 列表（131 个，4 个 scanRoot），但命令行输出不便于快速浏览全局。需要一个可以在浏览器里打开的 web UI，让人在宽屏下舒适浏览。

## 决定

- 单个自包含 HTML 文件，数据内嵌，零依赖，直接在浏览器打开
- 输出位置：`packages/cli/tui/devices-preview.html`
- 3200x1350 viewport 适配：6 列卡片网格，左侧导航锚定 scanRoot 分组
- 深色主题，简洁现代风格
- 每张卡片显示：repo 名称（醒目）+ 相对路径（次要）+ scanRoot 标签
- 搜索框实时过滤
- 顶部汇总统计（x 个 root / y 个 repo）

## TODO

- [x] 创建 `packages/cli/tui/devices-preview.html`
- [x] 嵌入真实数据
- [x] 布局：左侧 root 导航 + 右侧卡片网格
- [x] 搜索过滤
- [x] 响应式（宽屏优先）
