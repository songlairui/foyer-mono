---
id: 20260507-1019-ff5ec4
created: 2026-05-07T10:19:00+08:00
updated: 2026-05-07T10:40:00+08:00
title: foyer repo prepare — 跨设备按需克隆
type: feat
tags: [cli, multi-device, workspace]
---

## 起意

下班从工作电脑切换到家用电脑继续开发。A 设备 `foyer init` 初始化并推送了仓库，B 设备需要一条命令把 repo 拉下来继续工作。

## 决定

### 命名

`foyer repo prepare <slug>` — 确保指定 repo 在本地就绪。

当前模型是 1:1（一个 slug = 一个 repo），没有"project 包含多个 repo"的概念。现有 `foyer project init/list` 实为 repo 操作，后续应统一迁移到 `foyer repo` 下。

### 实现：完全复用已有数据

所有数据源已存在，无需新建配置文件：

| 数据                     | 来源                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| 有哪些 repo、remote 地址 | `foyer project list` → `~/.foyer/activity/events/**/*.jsonl`，过滤 `project.created` 事件 |
| 本机已 clone 哪些        | `foyer repo devices` → 扫描 `~/repo/projects/` 下含 `.git` 的目录                         |

### prepare 逻辑

```
1. project list 中找到 slug → 拿到 repositoryUrl
2. repo devices 检查本机是否已有
3. 没有 → git clone 到 ~/repo/projects/<slug>
4. 已有 → 报告已就绪
```

init-project 阶段写入 `project.created` 事件（含 repositoryUrl），prepare 自然可见。矩阵的"设备轴"来自 events 按 device 分目录存储。

### 前置依赖

- 各设备均已登录 gh（`foyer doctor` 检查）
- gh 多账户登录以后再说

## TODO

- `foyer doctor` — 全局健康检查（gh 认证、矩阵一致性）
- `foyer repo drop <slug>` — 工作区干净时删除本地目录节约空间
- `foyer project init/list` → 迁移到 `foyer repo init/list`
