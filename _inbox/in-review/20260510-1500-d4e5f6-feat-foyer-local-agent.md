---
id: 20260510-1500-d4e5f6
title: Foyer Local Agent — 本地通用 Web 服务
type: feat
tags: [cli, web, workspace, local-agent]
created: 2026-05-10T15:00:00+08:00
updated: 2026-05-10T15:30:00+08:00
status: in-review
started: 2026-05-10T15:00:00+08:00
reviewed_at: 2026-05-10T15:30:00+08:00
intent_root: 让任何本地 web UI（file:// 或 localhost）都能调用 OS 级能力，而无需 Electron 或原生 app
---

## 起意

为 devices web UI 做"点击打开项目"功能时，发现需要一个中间层：浏览器本身没有权限执行本地命令，但通过一个监听在 `127.0.0.1` 的 HTTP 服务，浏览器发一个 GET 请求就能触发 OS 操作。

这个模式并不新鲜——vue-devtools、React DevTools、Vite 的 "click to open in editor" 都用了同样的思路。区别在于，foyer 的场景更通用：不只是"打开文件"，而是"所有本地 web UI 都可能需要的 OS 操作"。

**本质**：local-agent 是一个 **本地 OS 能力代理**，让 web UI 从"只读展示"升级到"可操作工具"。

## 核心设计原则

1. **HTTP over stdin/stdout**：让任何 web 页面（包括 `file://`）都能直接调用，无需中间人
2. **无 auth**：仅监听 `127.0.0.1`，不对外暴露，安全边界在网络层
3. **读配置**：从 `~/.foyer/config.json` 读 opener，复用 `foyer set-opener` 的配置
4. **fire and forget**：触发 OS 操作后立即返回 `{ok: true}`，不等待操作完成

## 实施摘要

### 文件

| 文件                              | 说明                                      |
| --------------------------------- | ----------------------------------------- |
| `packages/cli/tui/local-agent.ts` | HTTP 服务入口，bun 直接执行               |
| `packages/cli/src/cli/index.ts`   | 新增 `foyer agent start/stop/status` 命令 |

### API（v0）

```
GET /health          → {ok, version, opener, port}
GET /open?path=PATH  → 用配置的 opener 打开目录，{ok, path, app}
GET /open?path=PATH&app=code  → 强制指定 opener
GET /reveal?path=PATH → macOS: open -R（Finder 中高亮）
OPTIONS /*           → CORS preflight（允许 file:// 请求）
```

### 启动方式

```bash
foyer agent start          # 后台启动，PID 写入 ~/.foyer/agent.pid
foyer agent status         # 查看运行状态
foyer agent stop           # 停止
bun run packages/cli/tui/local-agent.ts --port 7070  # 直接运行
```

### Web UI 集成模式

```javascript
// 健康检查（页面加载时）
const r = await fetch("http://127.0.0.1:7070/health", { signal: AbortSignal.timeout(1200) });

// 打开项目
await fetch(`http://127.0.0.1:7070/open?path=${encodeURIComponent(path)}`);
```

## 能力路线图

### v0（已实现）

- `/open` — 用 opener 打开目录
- `/reveal` — Finder 中高亮文件
- `/health` — 存活检查

### v1（待做）

- `/terminal?path=PATH` — 在该目录打开终端（iTerm2 / Terminal.app）
- `/git-status?path=PATH` — 返回 repo 的 git dirty/clean/branch 状态
- 复用 foyer 的 scan-roots 数据，提供 `/repos` 端点（代替 HTML 内嵌数据）

### v2（待做）

- `/run?cmd=foyer&args[]=...` — 白名单命令执行（foyer CLI 子命令）
- `/activity/append` — 打开项目时自动写 activity event（"opened" 类型）
- `--log` 选项 — 记录每次调用到 `~/.foyer/agent.log`

### v3（构想）

- 与 foyer web dashboard 深度集成，成为 dashboard 的本地能力后端
- 支持 WebSocket，实时推送 git status 变化
- 自动注册为 macOS 登录项（`launchd plist`）

## 边界与注意事项

- **只监听 127.0.0.1**：不接受外部连接，网络隔离保证安全
- **无 auth token（v0）**：路径打开操作风险低，后续如果加 `run` 能力再考虑 HMAC
- **path 校验**：`/open` 和 `/reveal` 在执行前调用 `existsSync(path)` 检查，404 返回明确错误
- **PID 管理**：`~/.foyer/agent.pid`，`foyer agent start` 先检查旧进程是否存活

## 与现有能力的关系

| 现有                 | local-agent 的角色                |
| -------------------- | --------------------------------- |
| `foyer open <slug>`  | CLI 版打开（需要 activity 历史）  |
| `foyer set-opener`   | 配置来源，agent 复用同一份 config |
| `foyer repo devices` | 提供 repo 路径数据给 web UI       |
| devices web UI       | local-agent 的首个消费方          |

local-agent 补全了"最后一公里"：从数据展示到真正可操作。

<details>
  <summary>原文</summary>

制作一个 localstorage 示例存储,记录项目点击次数. 然后, 制作一个点击就能唤起 本地工具打开对应项目的方式, 参考 vue-devtools 点击打开文件,应该是后台启动一个服务. 这让我感觉得到,这个服务可以制作为一个通用的中心组件.参考现在各种 local-agent 的能力.制作一个本地的 web 服务,支持通过 http 请求,打开对应位置. 感觉只是打开,应该没有安全风险,暂时不需要设计header 添加 auth token. 请补全我的构思,更新相关 md 文件

</details>
