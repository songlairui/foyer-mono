# Portless 接入踩坑记录

## 背景

为 `apps/web-ui` 接入 portless（Vercel 本地代理），将 `localhost:3000` 替换为 `https://web-ui.localhost`。

## 坑点

### 1. 全局 / 项目 portless 版本不一致

VitePlus 自带全局 portless v0.10.3（`~/.vite-plus/bin/portless`），项目安装的是 v0.13.0（`apps/web-ui/node_modules/.bin/portless`）。

- **现象**：`portless hosts sync` 报 `No active routes to sync`，但 `npx portless list` 能看到路由。
- **原因**：v0.10.3 与 v0.13.0 路由状态格式不兼容，旧版读不到新版注册的路由。
- **解决**：统一使用项目内的 portless（`npx portless`），或升级全局 portless。

### 2. 代理未受信任，SSL 握手失败

- **现象**：`curl https://web-ui.localhost` 报 `SSL_ERROR_SYSCALL`。
- **原因**：VitePlus 启动代理时带了 `--skip-trust`，CA 未添加到系统信任库。
- **排查**：`openssl s_client -connect 127.0.0.1:443 -servername web-ui.localhost` 返回 `unexpected eof while reading`、`no peer certificate available`。
- **解决**：`portless trust`（会弹 macOS 密码框安装 CA 到钥匙串）。如仍不行，停掉旧代理重启。

### 3. `.localhost` 子域名 DNS 不解析

- **现象**：浏览器打不开 `https://web-ui.localhost`。
- **原因**：macOS 系统解析器不认 `.localhost` 子域名（Chrome/Firefox 内置支持，但系统级和 Safari 不行）。
- **解决**：`npx portless hosts sync`（写入 `/etc/hosts`，需 sudo）。注意必须用项目内的 portless（见坑点 1），否则看不到路由。
- **手动兜底**：`sudo sh -c 'echo "127.0.0.1 web-ui.localhost" >> /etc/hosts'`。

### 4. IPv6/IPv4 不匹配导致 502

- **现象**：`https://web-ui.localhost` 返回 502，`proxy.log` 显示 `connect ECONNREFUSED 127.0.0.1:45xx`。但直接 `curl localhost:45xx` 能正常访问。
- **原因**：portless 代理走 IPv4（`127.0.0.1`），但 Vite dev server 默认监听 IPv6（`::1`），代理连不上后端。
- **验证**：`curl 127.0.0.1:45xx` 返回 `000`（连接被拒），`curl [::1]:45xx` 返回 `200`。
- **解决**：`vite.config.ts` 中显式配置 `server: { host: "127.0.0.1" }`，强制 Vite 监听 IPv4。

## 配置总结

`apps/web-ui/package.json`：

```json
{
  "scripts": {
    "dev": "portless",
    "dev:app": "vite dev"
  },
  "portless": { "name": "web-ui", "script": "dev:app" }
}
```

`apps/web-ui/vite.config.ts`：

```ts
const config = defineConfig({
  server: { host: "127.0.0.1" },
  // ...
});
```

## 相关

- portless v0.13.0：零参数模式、`portless.json` / `package.json` 内联配置
- VitePlus 管理的 portless v0.10.3 与项目版不兼容，优先用 `npx portless`
