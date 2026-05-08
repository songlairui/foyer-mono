---
name: init-project
description: 零配置项目落户入口。识别创建项目/初始化 repo/登记 Foyer 的请求，先调用 foyer CLI dry-run，再按确认结果执行。
---

# init-project

使用这个 skill 时，不要手工创建目录、patch Markdown 索引或直接读取 activity JSONL。确定性流程已经下沉到 `foyer` CLI。

## 工作流程

1. 提取或生成 `slug`、`description`、`lane`、`owner`。
2. 参数不清楚时先运行 `foyer project init --help`。
3. 调用 dry-run（CLI 会自动从 cwd 探测 `init-from`，并在 warnings 中展示结果）：

   ```bash
   foyer project init <slug> --desc "<中文描述>" --lane <lane> --owner <owner> --github --dry-run --json
   ```

4. 如果计划涉及 `--github`、push、覆盖、secret、不可逆操作，先向用户确认。
5. 执行：

   ```bash
   foyer project init <slug> --desc "<中文描述>" --lane <lane> --owner <owner> --github --json
   ```

6. 用 CLI 返回的 JSON 生成中文摘要。
7. 如果用户此前未配置 `foyer open`，提示运行 `foyer set-opener <opener>` 选择编辑器（候选: code, cursor, zed, windsurf, idea, subl）。
8. 配置完成后（或已配置），通过 `foyer open <slug>` 在编辑器中打开项目。
9. 创建 `docs/kickoff/START.md`，用**第一视角**把"为什么要启动这个项目"的原始意图写饱满，清晰：
   - 形式不限，就像写给半年后的自己看
   - 把触发你动手的那个念头、卡在什么地方、想通了什么，如实写下来；去掉犹豫试探等措词，确保意图直截了当。
   - 唯一要求：半年后回看，还能想起当初为什么要做这件事

10. 尝试根据聊天记录收集项目‘缘起’：
    - 如果有明确的意图缘起（比如一段触发这个项目的对话），在 `docs/kickoff/START.md` 旁边创建 `CHAT.md` 记录完整的对话过程
    - 如果聊天记录很少或没有，则不需要创建

> `--init-from <value>` 可手动传入来覆盖自动探测结果。

## 关键说明

- **必须传 `--github`**：否则不会创建远程仓库，`repositoryUrl` 为空，后续 `foyer repo prepare` 跨设备 clone 会失败。
- `--github-owner` 可选，不传时 CLI 自动从 `gh api user` 推断。

## foyer open / set-opener

- `foyer set-opener <opener>`：设置默认编辑器（code → VS Code, zed → Zed, cursor → Cursor 等）。
- `foyer open <slug>`：从 activity events 中查找项目本地路径，用配置的 opener 打开。
- 若 opener 未设置或项目尚未 clone，自动给出中文提示。

## 禁止事项

- 不直接读取 `~/.foyer/activity/events/**/*.jsonl`。
- 不手工插入 `projects/index.md`。
- 不让模型接触 GitHub token、API key、cookie、`.env`。
- 不把 graphify 或 Hyper-Extract 输出当成事实源。

## 兜底

- CLI 参数不清楚：运行 `foyer <command> --help`。
- 需要历史上下文：运行 `foyer activity context --project <slug> --budget 6000 --format markdown`。
- 需要精确引用：运行 `foyer search "<query>" --project <slug> --json`。
