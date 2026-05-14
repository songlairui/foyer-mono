---
id: 20260514-2028-62a381
title: 本地开发数据库申领
type: question
tags:
  - skill
  - llm
  - workspace
created: 2026-05-14T20:28:52+08:00
updated: 2026-05-14T20:36:00+08:00
status: todo
---

## 起意

本地启动新项目时，配置 Postgres 开发数据库消耗了不必要的注意力。目标是把“创建数据库、分配连接信息、写入项目可用配置”变成一个可申领的本地能力：人可以一键操作，LLM/agent 可以通过 skill 直接取用。

## 决定

- 先把范围限定为**本地开发数据库申领**，不覆盖生产、共享测试环境或远程托管数据库。
- 目标数据库类型先按 Postgres 设计。
- 安全策略从简：本地开发场景优先减少心智负担，避免引入复杂权限、密钥托管或审计体系。
- 需要同时服务两类入口：
  - 人类友好入口：一键申领并得到配置。
  - LLM 友好入口：通过 skill/CLI 快速申领和读取配置。
- 做成独立机制，不嵌入 Foyer。
- 本地或局域网会有一个已运行的 Postgres/DB 申领服务实例。
- 申领机制配置一组可创建数据库的凭据，由它负责创建数据库和返回连接配置。
- skill 的边界是“申领到数据库配置”；项目内写入交给项目自身、code agent，或由调用方显式传入写入位置。
- 数据库命名按实际项目情况生成，核心约束是避免重复。
- 第一版需要包含 reset/drop 类清理能力，但 destructive 操作必须显式确认。

## TODO

1. 梳理最小数据契约
   - 申领输入：项目标识、可选数据库名、可选用户名、可选重置/复用策略。
   - 申领输出：host、port、database、user、password、connection string，以及推荐写入位置。
   - 状态记录：已申领数据库、归属项目、创建时间、最近取用时间。

2. 设计独立 CLI / 服务命令草案
   - `dev-db claim <project>`：为项目申领或复用本地/局域网 Postgres 数据库。
   - `dev-db config <project>`：读取已有配置。
   - `dev-db list`：列出当前 registry 中已申领的开发数据库。
   - `dev-db drop <project>` 或 `dev-db reset <project>`：清理或重置开发库，需确认。
   - `dev-db configure`：配置可创建数据库的管理员连接信息。

3. 设计 skill 交互草案
   - `dev-db claim` / `postgres claim`：自动调用独立 CLI/服务，返回可复制配置。
   - 默认只返回申领结果，不擅自写入项目文件。
   - 可支持 `--write <path>` 或显式参数，把连接配置写入调用方指定位置。
   - 对 destructive 操作保持显式确认。

4. 确认 registry 与配置存储位置
   - 申领工具自身维护本地 registry，不写入 Foyer entry。
   - 项目 `.env.local` / `.env.example` / 文档片段由项目自身或 code agent 写入。
   - 需要避免把真实密码提交进 Git。

5. 检查实现落点
   - 独立包/脚本承载确定性申领逻辑。
   - skill 只包装调用、解释返回值、执行可选写入。
   - 不修改 Foyer CLI/workflow。

## 待用户确认

已确认：

1. 做成独立机制，不嵌入 Foyer。
2. 本地/局域网已有运行实例；工具配置可创建数据库的凭据。
3. skill 默认只申领并返回配置；写入项目由项目自身、code agent 或显式写入参数处理。
4. 命名根据实际情况生成，确保不重复。
5. 第一版包含清理能力，destructive 操作需要确认。

仍需确认：

1. 独立机制的形态：npm 包 CLI、单文件脚本、常驻服务，还是 CLI + 可选服务？
2. registry 放在哪里：用户 home 目录、XDG config/data 目录，还是跟随该独立工具的配置目录？
3. 返回格式需要支持哪些：human、dotenv、JSON、shell export？
4. 是否只支持 Postgres 第一版，还是抽象出 provider 以便后续支持 MySQL/Redis？

<details>
  <summary>原文</summary>

每次我启动项目，要在本地开发配置数据库，就很有心智负担。 为此，我尝试设计一个postgres db 申领机制，有个人类友好的界面，一键申领，并得到配置。
现在，可以制作 llm friendly 的机制了，通过 skill 快速取用。 因为是本地开发，所以对安全的设定可以简单。

</details>
