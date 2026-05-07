---
id: 20260507-mdreader-01-67554d
created: 2026-05-07T12:00:00+08:00
updated: 2026-05-07T17:10:30+08:00
title: /prepare-vitepress — 为已有 markdown 文档集添加 vitepress
type: feat
tags: [skill, vitepress, md-reader]
source: md-reader
status: in-progress
started: 2026-05-07T17:30:00+08:00
---

## 起意

md-reader 项目需要 vitepress 能力。此前在 effect-ts-tutor、k3s-tutor 已手动做了两遍，操作步骤已沉淀为 lesson（`~/repo/projects/k3s-tutor/docs/lesson/adding-vitepress-to-existing-docs.md`）。两次实践确立了三条核心规则：`.vitepress/` 放进内容目录内、用 CLI 子命令指定源目录（`vitepress dev <dir>`）、不改动任何现有文件。现在 md-reader 有同样需求，是时候把这套流程封装为可复用的 skill，避免第三次手动重复。

## 决定

在 foyer-mono 创建 `/prepare-vitepress` skill，文件路径：`skills/prepare-vitepress/SKILL.md`。

**触发短语**：`/prepare-vitepress`、「加装 vitepress」、「给这个项目加 vitepress」、「给 <目录> 加 vitepress」。

**skill 三段式设计如下：**

### 工作流程

> 每步均不改动现有文件。遇到冲突，停止并提示，不自行覆盖。

1. **收集参数**（询问用户，或从当前上下文推断）
   - `content_dir`：markdown 内容目录路径（相对于项目根，例如 `docs`、`tutor`）
   - `project_name`：网站标题
   - `github_url`：GitHub 仓库链接（用于 socialLinks，可选）

2. **检查前置条件**
   - 确认 `content_dir` 存在且包含 `.md` 文件
   - 检查 `<content_dir>/.vitepress/` 是否已存在 → 若存在，告知用户并停止（不覆盖）
   - 检查项目根是否有 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`，记录包管理器选择

3. **安装 vitepress**（在项目根运行）

   ```bash
   # 按检测到的包管理器选择对应命令：
   pnpm add -D vitepress        # pnpm 优先使用
   npm install -D vitepress     # npm
   yarn add -D vitepress        # yarn
   ```

   若项目根无 `package.json`，先执行 `pnpm init`（或对应初始化命令）。
   pnpm 额外步骤：`pnpm approve-builds esbuild`。

4. **创建 `<content_dir>/.vitepress/config.mjs`**

   ```js
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
         {
           text: "<project_name>",
           items: [
             // agent 扫描 content_dir 下的 .md 文件，
             // 按文件名排序，自动生成以下格式：
             // { text: '<H1 标题或文件名>', link: '/<文件名去扩展名>' }
             // README.md 排在最后（作为目录页）
           ],
         },
       ],

       socialLinks: [
         // 仅当 github_url 非空时添加：
         // { icon: 'github', link: '<github_url>' }
       ],

       outline: { level: [2, 3], label: "本页目录" },
       docFooter: { prev: "上一章", next: "下一章" },
       darkModeSwitchLabel: "深色模式",
       sidebarMenuLabel: "菜单",
       returnToTopLabel: "回到顶部",
     },
   });
   ```

   sidebar items 由 agent 扫描 `content_dir` 下的 `.md` 文件自动生成，取每个文件第一个 `# H1` 作为 text，文件名去扩展名作为 link。

5. **创建 `<content_dir>/index.md`**（hero 首页，仅当该文件不存在时创建）

   ```md
   ---
   layout: home

   hero:
     name: <project_name>
     text: 一句话描述
     tagline: 副标题
     actions:
       - theme: brand
         text: 开始阅读
         link: /<第一个非 README 的文件名去扩展名>
       - theme: alt
         text: 查看目录
         link: /README

   features:
     - icon: 📖
       title: 功能特性一
       details: 简短说明
   ---
   ```

   `text`、`tagline`、`features` 由 agent 根据 `project_name` 和现有文档内容生成，可后续手动调整。

6. **在 `package.json` 中添加 scripts**

   ```json
   {
     "scripts": {
       "docs:dev": "vitepress dev <content_dir>",
       "docs:build": "vitepress build <content_dir>",
       "docs:preview": "vitepress preview <content_dir>"
     }
   }
   ```

   若 `package.json` 已有 `scripts`，追加；若 key 冲突（如已有 `docs:dev`），告知用户不覆盖。

7. **验证提示**
   - 输出：`✓ VitePress 已就绪，运行 pnpm docs:dev 启动`
   - 列出创建的文件清单（仅新建的，不含安装的 node_modules）

### 禁止事项

- **不移动、不改名、不修改任何现有 `.md` 文件**
- 不修改已存在的 `package.json` scripts（key 冲突时告知停止，不静默覆盖）
- 不覆盖已存在的 `.vitepress/` 目录
- 不覆盖已存在的 `index.md`
- 不用 `srcDir` 配置项 —— 改用 CLI 子命令路径
- 不把 README.md 的全文复制到首页 —— hero layout 专用于首页，README 保留为目录页

### 兜底

- 包管理器无法判断（无锁文件）：询问用户，默认 pnpm
- `content_dir` 下文件无 H1 标题：用文件名（去扩展名、去前缀数字）作为 sidebar text
- sidebar 文件过多（>20 个）：告知用户，等确认后再生成，避免生成过长的 config
- vitepress 安装失败：粘贴错误信息，停止，不继续创建文件

## TODO

- [ ] 在 `skills/prepare-vitepress/SKILL.md` 创建 skill 文件（按本设计稿实现）
- [ ] 运行 `./sync-skills.sh` 将新 skill 同步到 `~/.agents/skills/`
- [ ] 在 md-reader 项目中触发 `/prepare-vitepress`，验证 skill 有效
- [ ] 完成后通过 `inbox` skill 投递回 md-reader 项目（`_inbox/`）

## 已确认决定

**Q0：参数收集策略**（用户补充）
优先从上下文自动推断（`project_name` 取 `package.json` 的 name/description，`github_url` 取 `repository.url`），只在无法推断时才询问。尽可能减少打断用户。

**Q1：sidebar 生成策略** → 选项 B（多级嵌套）
支持递归扫描多级子目录，自动生成嵌套 sidebar。但封面页（`index.md`）打开后，其子页面若还有嵌套子级，不需要全部遍历——合理深度（2-3 级）即可，超深层手动补充。

**Q2：config 语言** → 优先 `.ts`
检测项目是否有 TypeScript（有 `tsconfig.json` 或 `.ts` 文件），有则用 `.ts`；无则也默认 `.ts`（能用 ts 就用 ts）。

**Q3：首页内容** → 由 code agent 生成
`text` / `tagline` / `features` 由 agent 根据文档内容生成，标注「可后续手动调整」。
