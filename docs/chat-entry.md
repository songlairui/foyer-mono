# Chat Entry

## 概述

全局入口面板，底部悬浮。收起态仅露出 ChevronUp 触发器，展开态显示页面上下文 + 输入框。纯 transform 动画，无布局重排。回车后在 Ghostty 终端中执行 `pi <输入内容>`。

## 文件

```
apps/web-ui/src/components/chat/
├── ChatContext.tsx      # 全局状态：开关、页面上下文
├── ChatDrawer.tsx       # 主组件：触发按钮 + 动画面板 + 终端调用
├── NoteStorage.ts       # localStorage 笔记持久化（备用）
└── WaterDropTrigger.tsx # 最小化浮动触发器

apps/web-ui/src/orpc/router/
└── agent.ts             # openTerm handler：Nitro 服务端直接 execFile
```

## 状态管理

全局 ChatContext 管理：

- `isOpen: boolean` — 面板展开/收起
- `pageContext: PageContext` — 当前页面的上下文标识（route, title, extra）

## 交互流程

```
[收起态]                     [展开态]
┌─────────────────┐         ┌──────────────────────┐
│                 │         │  Page: /dashboard    │← page context
│                 │         │                      │
│                 │         │  ┌──────────────────┐│
│         ▲       │  click  │  │ 输入...          ││
│                 │  ─────→ │  └──────────────────┘│
│                 │         │                      │
│                 │         │  Enter → Ghostty     │← 打开终端执行 pi
│                 │         │          ▼           │
└─────────────────┘         └──────────────────────┘
```

## Enter 行为

1. `ChatDrawer.handleSend` 调用 `orpc.agent.term` mutation
2. ORPC handler 在 Nitro 服务端直接执行 `open -na Ghostty.app --args --working-directory=<dir> -e pi <cmd>`
3. Ghostty 窗口在项目目录打开，自动执行 `pi <输入文本>`
4. 成功：清空输入、移除草稿、关闭面板
5. 失败：toast 错误提示，保留输入内容

目录默认使用 Nitro 进程的 `process.cwd()`。可通过传入 `dir` 参数覆盖。

## 动画

- 面板使用 framer-motion `transform` 动画，不触发 Layout Shift
- 收起态通过 `translateY` 将面板移出视口，只保留 ChevronUp 按钮可见
- `maxHeight` 动画控制内容区显隐

## 草稿持久化

- 输入内容 300ms 防抖写入 localStorage，key 为 `foyer.chat.draft`
- 组件初始化时从 localStorage 恢复草稿
- 发送成功后清空草稿

## 快捷键

| 键            | 条件                   | 行为           |
| ------------- | ---------------------- | -------------- |
| `c`           | 非输入元素内           | 打开/关闭面板  |
| `Enter`       | 面板已打开，输入框聚焦 | 发送到 Ghostty |
| `Shift+Enter` | 面板已打开             | 换行           |
| `Escape`      | 面板已打开             | 关闭面板       |
| `/`           | 非输入元素内           | 聚焦搜索框     |
