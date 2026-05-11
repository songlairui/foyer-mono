import { os } from "@orpc/server";
import { execFile } from "node:child_process";
import { platform } from "node:os";
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

export const openTerm = os
  .input(
    z.object({
      cmd: z.string().min(1),
      dir: z.string().optional(),
    }),
  )
  .handler(({ input }) => {
    const dir = input.dir ?? process.cwd();

    if (platform() === "darwin") {
      // AppleScript: 通过 stdin 传脚本（避免 -e 参数中的编码问题），中文不乱码
      const asEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const safeCmd = input.cmd.replace(/'/g, "'\\''");
      const shell = process.env.SHELL || "/bin/fish";
      const shellCmd = `${shell} -l -c '${safeCmd}'`;
      const script = [
        'tell application "Ghostty"',
        "    set cfg to new surface configuration",
        "    tell cfg",
        `        set initial working directory to "${asEsc(dir)}"`,
        `        set command to "${asEsc(shellCmd)}"`,
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
      // 通过 stdin 传脚本，避免 -e 参数可能引发的编码问题
      const proc = execFile("osascript", ["-"]);
      proc.stdin!.write(script);
      proc.stdin!.end();
    } else {
      const shell = process.env.SHELL || "/bin/sh";
      const safeCmd = input.cmd.replace(/'/g, "'\\''");
      execFile("ghostty", ["--working-directory=" + dir, "-e", shell, "-c", safeCmd], (err) => {
        if (err) console.error("term open error:", err.message);
      });
    }
    return { ok: true };
  });
