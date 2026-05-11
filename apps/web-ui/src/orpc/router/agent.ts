import { os } from "@orpc/server";
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as z from "zod";

const AGENT_BASE = "http://127.0.0.1:7070";

export const agentHealth = os.handler(async () => {
  try {
    const r = await fetch(`${AGENT_BASE}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (!r.ok) return { online: false as const, opener: null };
    const d = (await r.json()) as { opener?: string };
    return { online: true as const, opener: d.opener ?? null };
  } catch {
    return { online: false as const, opener: null };
  }
});

export const openRepo = os
  .input(
    z.object({
      path: z.string().min(1),
      app: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const url = new URL(`${AGENT_BASE}/open`);
    url.searchParams.set("path", input.path);
    if (input.app) url.searchParams.set("app", input.app);

    const r = await fetch(url.toString(), {
      signal: AbortSignal.timeout(3000),
    });
    const body = (await r.json()) as { ok: boolean; error?: string; app?: string };
    if (!r.ok) throw new Error(body.error ?? "打开失败");
    return { app: body.app ?? null };
  });

export const revealRepo = os
  .input(z.object({ path: z.string().min(1) }))
  .handler(async ({ input }) => {
    const url = new URL(`${AGENT_BASE}/reveal`);
    url.searchParams.set("path", input.path);
    await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    return { ok: true };
  });

/**
 * 写临时 shell 脚本再执行，避免中文/特殊字符经过
 * AppleScript → Ghostty → shell 多层引用时丢失或乱码。
 * 脚本路径只有安全 ASCII 字符，AppleScript 只传路径，不涉及输入内容。
 */
function openInGhostty(dir: string, rawInput: string) {
  const shell = process.env.SHELL || "/bin/fish";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpSh = `/tmp/pi-${stamp}.sh`;

  // 嵌入到 shell 脚本中，只转义输入中的单引号
  const quoted = rawInput.replace(/'/g, "'\\''");
  writeFileSync(tmpSh, `#!/bin/sh\n${shell} -l -c 'pi ${quoted}'\nrm -f '${tmpSh}'\n`, {
    mode: 0o755,
  });

  const asEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = [
    'tell application "Ghostty"',
    "    set cfg to new surface configuration",
    "    tell cfg",
    `        set initial working directory to "${asEsc(dir)}"`,
    `        set command to "${asEsc(tmpSh)}"`,
    "        set wait after command to true",
    "    end tell",
    "    try",
    "        set w to front window",
    "        new tab in w with configuration cfg",
    "    on error",
    "        new window with configuration cfg",
    "    end try",
    "    activate",
    "end tell",
  ].join("\n");

  execFile("osascript", ["-e", script], (err) => {
    if (err) console.error("term open error:", err.message);
  });
}

export const openTerm = os
  .input(
    z.object({
      cmd: z.string().min(1),
      dir: z.string().optional(),
    }),
  )
  .handler(({ input }) => {
    openInGhostty(input.dir ?? process.cwd(), input.cmd);
    return { ok: true };
  });
