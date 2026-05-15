---
id: 20260515-1500
title: 新设备一键 bootstrap 引导
type: feat
tags: [cli, multi-device, workspace]
created: 2026-05-15T15:00:00+08:00
updated: 2026-05-15T15:00:00+08:00
status: in-review
started: 2026-05-15T15:10:00+08:00
reviewed_at: 2026-05-15T15:30:00+08:00
---

foyer 已有 `repo prepare` 用于跨设备同步仓库，但新设备首次初始化流程较繁琐（需手动安装 CLI、配置 `~/.foyer`、登录 gh 等）。希望通过单条命令（考虑 `npx` 执行 GitLab repo 的方式）完成整个新设备 bootstrap。

<details>
  <summary>原文</summary>

当前我只做了 foyer 用于从我的中心化仓库拉取和同步,但是当我有了一个新的设备的时候,我初始化起来比较麻烦.你觉得应该怎么办?

直接 一行命令 npx 执行 一个 gitlab repo 可以吗?

</details>
