import { os } from "@orpc/server";
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
