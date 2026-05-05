---
name: init-project
description: 零配置项目初始化入口。识别创建项目/初始化 repo/登记 entry 的请求，先调用 entry CLI dry-run，再按确认结果执行。
---

# init-project

使用这个 skill 时，不要手工创建目录、patch Markdown 索引或直接读取 activity JSONL。确定性流程已经下沉到 `entry` CLI。

## 工作流程

1. 提取或生成 `slug`、`description`、`lane`、`owner`。
2. 参数不清楚时先运行 `entry project init --help`。
3. 调用 dry-run：

```bash
entry project init <slug> --desc "<中文描述>" --lane <lane> --owner <owner> --dry-run --json
```

4. 如果计划涉及 `--github`、push、覆盖、secret、不可逆操作，先向用户确认。
5. 执行：

```bash
entry project init <slug> --desc "<中文描述>" --lane <lane> --owner <owner> --json
```

6. 用 CLI 返回的 JSON 生成中文摘要。

## 禁止事项

- 不直接读取 `~/entry/activity/events/**/*.jsonl`。
- 不手工插入 `projects/index.md`。
- 不让模型接触 GitHub token、API key、cookie、`.env`。
- 不把 graphify 或 Hyper-Extract 输出当成事实源。

## 兜底

- CLI 参数不清楚：运行 `entry <command> --help`。
- 需要历史上下文：运行 `entry activity context --project <slug> --budget 6000 --format markdown`。
- 需要精确引用：运行 `entry search "<query>" --project <slug> --json`。
