---
name: prepare-vitepress
description: |
  为已有 Markdown 文档集一键添加 VitePress，生成 config.ts、index.md、scripts。
  不移动、不改名、不修改任何现有文件。
  触发：「/prepare-vitepress」「加装 vitepress」「给这个项目加 vitepress」「给 <目录> 加 vitepress」。
---

# prepare-vitepress

为已有 Markdown 文档目录添加 VitePress，不改动任何现有文件。

## 核心规则

- **不移动、不改名、不修改任何现有 `.md` 文件**
- 不覆盖已存在的 `.vitepress/` 目录
- 不覆盖已存在的 `index.md`
- 不修改已存在的 `package.json` scripts（key 冲突时告知停止）
- 不用 `srcDir` 配置项——改用 CLI 子命令路径 `vitepress dev <content_dir>`
- 不把 README.md 内容复制到首页

## 工作流程

### 第 0 步：收集参数（优先推断，最小化打断）

按以下优先级推断参数，**无法推断时才询问**：

| 参数           | 推断来源                                                                           | 备注                                        |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `content_dir`  | 找包含最多 `.md` 文件的子目录；若只有根目录有 `.md` 则用 `.`                       | 优先 `docs/`、`tutor/`、`guide/` 等常见名称 |
| `project_name` | `package.json` 的 `name` 或 `description`（取后者若存在且更具描述性）              | fallback：目录名                            |
| `github_url`   | `package.json` 的 `repository.url`（清理 `git+` 前缀和 `.git` 后缀）               | 可选，无则跳过 socialLinks                  |
| 包管理器       | 检查锁文件：`pnpm-lock.yaml` → pnpm，`yarn.lock` → yarn，`package-lock.json` → npm | 无锁文件默认 pnpm                           |
| config 语言    | 检查 `tsconfig.json` 或项目内是否有 `.ts` 文件 → 用 `.ts`；否则也默认 `.ts`        | 用户指定优先                                |

一次性询问所有无法推断的参数（最多问一轮），不来回确认。

### 第 1 步：检查前置条件

```
✓ content_dir 存在且包含 .md 文件
✓ <content_dir>/.vitepress/ 不存在（已存在则停止）
✓ <content_dir>/index.md 不存在（已存在则标记跳过，不报错）
```

若 `.vitepress/` 已存在：输出提示，停止，不继续。

### 第 2 步：安装 VitePress

若 `package.json` 不存在，先初始化：

```bash
pnpm init   # 或对应包管理器
```

安装：

```bash
# pnpm（优先）
pnpm add -D vitepress
pnpm approve-builds esbuild   # pnpm 必须显式允许

# npm
npm install -D vitepress

# yarn
yarn add -D vitepress
```

安装失败时：输出错误信息，停止，不继续创建文件。

### 第 3 步：扫描 Markdown 文件，生成 sidebar

递归扫描 `content_dir` 下所有 `.md` 文件，支持多级嵌套。规则：

1. **排除**：`index.md`（首页）、`.vitepress/` 下的文件
2. **取标题**：读文件第一行 `# H1` 作为 text；无 H1 则用文件名（去扩展名，去前缀数字和连字符，如 `01-intro` → `intro`）
3. **排序**：按文件名字母序（数字前缀文件自然有序）
4. **README.md**：排在同级最后（作为目录页），link 为 `/README`

**多级目录处理（最多 3 层）：**

```
content_dir/
├── 01-intro.md          → sidebar 顶层 item
├── guide/
│   ├── index.md         → 子组的封面（link: /guide/）
│   ├── 01-start.md      → 子组 items
│   └── 02-config.md
└── api/
    ├── overview.md
    └── reference.md
```

生成：

```ts
sidebar: [
  { text: "intro", link: "/01-intro" },
  {
    text: "guide", // 取目录名或 index.md 的 H1
    link: "/guide/", // 仅当子目录有 index.md 时添加 link
    collapsed: false,
    items: [
      { text: "快速开始", link: "/guide/01-start" },
      { text: "配置", link: "/guide/02-config" },
    ],
  },
  // ...
];
```

超过 3 层的子目录：生成到第 3 层后停止，在 config 注释中标记 `// TODO: 更深层级需手动补充`。

文件数超过 20 个：告知用户，等确认后再生成，避免一次性产出过长 config。

### 第 4 步：生成 `<content_dir>/.vitepress/config.ts`

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "<project_name>",
  lang: "zh-CN",

  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "目录", link: "/README" },
    ],

    sidebar: [
      // agent 按第 3 步结果填充
    ],

    socialLinks: [
      // 仅当 github_url 非空时：
      // { icon: "github", link: "<github_url>" },
    ],

    outline: { level: [2, 3], label: "本页目录" },
    docFooter: { prev: "上一章", next: "下一章" },
    darkModeSwitchLabel: "深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "回到顶部",
  },
});
```

### 第 5 步：生成 `<content_dir>/index.md`（首页）

仅当该文件**不存在**时创建。

Agent 读取现有文档（README.md + 前 3 个章节的 H1/H2）生成内容：

```md
---
layout: home

hero:
  name: <project_name>
  text: <一句话描述，从 README 或文档内容提炼>
  tagline: <副标题>
  actions:
    - theme: brand
      text: 开始阅读
      link: /<第一个非 README 文件名去扩展名>
    - theme: alt
      text: 查看目录
      link: /README

features:
  - icon: 📖
    title: <特性一，从文档主题提炼>
    details: <简短说明>
  - icon: 🚀
    title: <特性二>
    details: <简短说明>
  - icon: ⚡
    title: <特性三>
    details: <简短说明>
---
```

`text`、`tagline`、`features` 由 agent 根据文档内容生成，标注可后续手动调整。

### 第 6 步：在 `package.json` 中添加 scripts

追加（不覆盖已有 key）：

```json
{
  "scripts": {
    "docs:dev": "vitepress dev <content_dir>",
    "docs:build": "vitepress build <content_dir>",
    "docs:preview": "vitepress preview <content_dir>"
  }
}
```

若 `docs:dev` 等 key 已存在：告知用户，不覆盖，继续其余步骤。

### 第 7 步：验证提示

输出：

```
✓ VitePress 已就绪

新建文件：
  <content_dir>/.vitepress/config.ts
  <content_dir>/index.md          （首页，可手动调整 text/tagline/features）

修改文件：
  package.json                    （追加 docs:dev / docs:build / docs:preview）

启动：pnpm docs:dev
构建：pnpm docs:build
```

## 兜底

| 情况                            | 处理                                            |
| ------------------------------- | ----------------------------------------------- |
| 包管理器无法判断（无锁文件）    | 推断为 pnpm，不询问                             |
| `content_dir` 下文件无 H1       | 用文件名（去扩展名去前缀数字）作为 sidebar text |
| sidebar 文件 >20 个             | 告知用户，等确认后再生成                        |
| vitepress 安装失败              | 粘贴错误信息，停止，不继续创建文件              |
| `.vitepress/` 已存在            | 停止并提示，不覆盖                              |
| `index.md` 已存在               | 跳过第 5 步，继续其余步骤                       |
| `package.json` scripts key 冲突 | 告知冲突的 key，跳过该 key，继续写入其余 key    |
