---
id: 20260510-2124
title: RepoCard 仓库信息增强
type: feat
tags: [web, workspace, repo]
created: 2026-05-10T21:24:15+0800
updated: 2026-05-10T21:24:15+0800
status: tapped
---

# RepoCard 仓库信息增强

apps/web-ui 后续计划补齐 RepoCard 的仓库信息展示：

- remote 为 GitHub 时，支持在客户端查询仓库 star 数；考虑到请求开销较大，可以做一个中转缓存 API。
- 支持展示 repo 的 worktree 信息：存在 worktree 时显示标记，并关联展示各个 worktree。
- 未来支持将同一 repo 的多次 clone 副本转换为 worktree，该方向待定。

<details>
  <summary>原文</summary>

apps/web-ui 未来计划功能：

- repocard 的显示 - 对于 remote 是 github 的，支持client端 查询 repo 的 star（感觉很耗请求，可以做个中转缓存api）
- repo 的worktree 信息支持一下。有 worktree 的显示个标记，再关联上各个worktree
  -- 未来支持 - 将同 repo 的多次 clone 副本转换为 worktree （待定）

</details>
