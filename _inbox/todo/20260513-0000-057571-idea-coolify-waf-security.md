---
id: 20260513-0000-057571
title: Coolify 环境部署 WAF 安全防护
type: idea
tags: [infra, security, homelab]
created: 2026-05-13T00:00:00+08:00
updated: 2026-05-13T00:00:00+08:00
status: todo
---

# Coolify 环境部署 WAF 安全防护

## 起意

局域网 NAS 上的 Coolify 通过 Caddy 反代暴露在公网（IPv6），目前无任何 WAF 防护，存在被扫描和攻击的风险。需要部署 WAF 来实现：

- 识别攻击流量来源（IP、地理分布、攻击类型）
- 自动拦截恶意请求（SQLi、XSS、路径遍历等）
- 提供可视化面板查看攻击事件

## 决定

- **首选 SafeLine（雷池）**：Docker 部署、有 Web 管理面板、语义分析引擎、中文社区活跃
- **SafeLine 前置**：作为第一层反代，Caddy/Coolify 退居其后
- **CrowdSec 作为后续补充**：IP 层封禁，覆盖 SafeLine 未拦截的恶意 IP
- 暂不考虑 Caddy + Coraza（需编译、无 UI）和 BunkerWeb（过重）

部署拓扑：

```
Internet → SafeLine (WAF) → Caddy/Coolify → 后端服务
```

## TODO

| #   | 事项                                                      | 状态 |
| --- | --------------------------------------------------------- | ---- |
| 1   | 确认 NAS 资源是否满足 SafeLine 最低要求（建议 2C4G）      | ⬜   |
| 2   | 在 NAS 上通过 Docker Compose 部署 SafeLine                | ⬜   |
| 3   | 配置 Caddy 退居 SafeLine 之后（或 SafeLine 直接反代后端） | ⬜   |
| 4   | 验证攻击检测功能与面板展示                                | ⬜   |
| 5   | （可选）部署 CrowdSec + Caddy bouncer，叠加 IP 层封禁     | ⬜   |
| 6   | 配置告警通知（飞书/邮件/webhook）                         | ⬜   |

## 待用户确认

1. **方案确认**：SafeLine 作为首选 WAF 方案是否认可？还是有其他偏好？
2. **部署时机**：计划什么时候动手？是否有明确的截止时间？
3. **资源评估**：NAS 当前剩余资源（CPU/内存）是否足够跑 SafeLine？
4. **范围确认**：先只上 SafeLine 观察一段时间，还是同时上 CrowdSec？
5. **暴露面盘点**：Coolify 上跑了哪些服务？哪些需要过 WAF，哪些可以直连？

<details>
  <summary>原文 & 讨论上下文</summary>

用户在局域网 NAS 上架设了 Coolify，通过 Caddy 反代出去（有公网 IPv6）。最初问「如何监控流量来源」，澄清后明确需要的是 WAF（Web Application Firewall），不是网页分析工具。

推荐方案：

- SafeLine（雷池）— 首选，Docker 部署，Web UI
- CrowdSec — IP 层封禁，与 SafeLine 互补
- BunkerWeb — nginx + ModSecurity（较重）
- Caddy + Coraza — 最轻但需编译 Caddy（不推荐）

用户表示现在没时间探索，需要存档以便未来重新启动。

</details>
