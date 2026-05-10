#!/usr/bin/env bun
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const PORT = parsePort(process.argv);
const CONFIG_PATH = join(homedir(), ".foyer", "config.json");

type JsonBody = Record<string, unknown>;

function getOpener(): string {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
    if (typeof config.opener === "string" && config.opener.length > 0) return config.opener;
  } catch {
    // fall through to platform default
  }
  return platform() === "darwin" ? "open" : "xdg-open";
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url) {
    send(res, 400, { ok: false, error: "no url" });
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") {
    send(res, 200, { ok: true, version: "0.1.0", opener: getOpener(), port: PORT });
    return;
  }

  if (url.pathname === "/open") {
    const targetPath = url.searchParams.get("path");
    if (!targetPath) {
      send(res, 400, { ok: false, error: "missing ?path=" });
      return;
    }
    if (!existsSync(targetPath)) {
      send(res, 404, { ok: false, error: `path not found: ${targetPath}` });
      return;
    }
    const app = url.searchParams.get("app") ?? getOpener();
    execFile(app, [targetPath], (err) => {
      if (err) process.stderr.write(`open error: ${err.message}\n`);
    });
    send(res, 200, { ok: true, path: targetPath, app });
    return;
  }

  if (url.pathname === "/reveal") {
    const targetPath = url.searchParams.get("path");
    if (!targetPath) {
      send(res, 400, { ok: false, error: "missing ?path=" });
      return;
    }
    if (platform() === "darwin") {
      execFile("open", ["-R", targetPath], () => {});
    } else {
      execFile("xdg-open", [targetPath], () => {});
    }
    send(res, 200, { ok: true, path: targetPath, action: "reveal" });
    return;
  }

  send(res, 404, { ok: false, error: "unknown route" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`foyer local-agent listening on http://127.0.0.1:${PORT}\n`);
});

function send(res: ServerResponse, status: number, body: JsonBody): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function parsePort(argv: string[]): number {
  const idx = argv.indexOf("--port");
  if (idx >= 0 && argv[idx + 1]) return parseInt(argv[idx + 1], 10);
  return 7070;
}
