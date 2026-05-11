# Chat Entry

## 概述

全局 AI 对话入口，底部悬浮面板。收起态仅露出 ChevronUp 触发器，展开态显示页面上下文 + 输入框。纯 transform 动画，无布局重排。AI 对话能力尚未实现，当前输入仅保存为本地笔记。

## 文件

```
apps/web-ui/src/components/chat/
├── ChatContext.tsx      # 全局状态：开关、页面上下文
├── ChatDrawer.tsx       # 主组件：触发按钮 + 动画面板
├── NoteStorage.ts       # localStorage 笔记持久化
└── storage.test.ts      # 持久化单元测试
```

## 状态管理

全局 ChatContext 管理两个核心状态：

- `isOpen: boolean` — 面板展开/收起
- `pageContext: ChatPageContext` — 当前页面的上下文标识（pathname, title, description）

提供 `setIsOpen` 和 `setPageContext` 两个 setter。

## 交互流程

```
[收起态]                     [展开态]
┌─────────────────┐         ┌──────────────────────┐
│                 │         │  Page: /dashboard    │← page context
│                 │         │                      │
│                 │         │  ┌──────────────────┐│
│         ▲       │  click  │  │ 输入笔记...      ││
│                 │  ─────→ │  └──────────────────┘│
│                 │         │                      │
│                 │         │          ▼           │← ChevronDown
└─────────────────┘         └──────────────────────┘
```

## 动画

- 整个面板使用 `transform` + `opacity` 过渡，不触发 Layout Shift
- 收起态通过 `translateY` 将面板移出视口，只保留 ChevronUp 按钮可见
- 展开/收起由 isOpen CSS class 切换驱动
- 使用 CSS `transition` 属性控制动画时长和缓动函数

## 笔记存储

- 使用 localStorage 持久化，key 格式为 `chat-note:<pathname>`
- 每次输入框失焦时自动保存（若页面上下文携带 pathname 且输入内容非空）
- 再次进入同一路径时自动加载历史笔记
- 输入框聚焦时不自动加载（避免覆盖用户当前输入）
- 笔记在展开态按下 Escape 或点击 ChevronDown 时保存

## 局限

- 当前只做笔记保存，无 AI 对话能力
- localStorage 存储，非服务端持久化
