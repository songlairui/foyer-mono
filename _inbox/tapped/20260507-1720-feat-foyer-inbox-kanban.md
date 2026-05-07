---
id: 20260507-1720
created: 2026-05-07T17:20:00+08:00
updated: 2026-05-07T17:20:00+08:00
title: foyer 跨仓库 inbox 看板
type: feat
tags: [cli, inbox, workspace]
status: tapped
---

foyer 增加一个看板，汇聚当前设备上所有 repo 的 inbox 条目。按 repo 分组，列出各 tapped / todo / in-progress 状态项。

扫描路径：`~/repo/projects/` 下各目录的 `_inbox/`。数据量大时可只展示近期活跃条目（如近 30 天），或引入轻量索引。实现时机待定。

<details>
  <summary>原文</summary>

未来需求 - 给我的 foyer 增加一个看板,列出来每个 repo 的inbox. 如果数量太多, 则需要考虑数据库,或者近期有效,或者轮询检查. 需要做的时候再想

</details>
