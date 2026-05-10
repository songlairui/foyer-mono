import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo } from "react";
import { FolderOpen, Search, Circle, FolderSearch } from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

const CLICK_KEY = (path: string) => `foyer.repo.click.${path}`;

function getClickCount(path: string): number {
  try {
    return parseInt(localStorage.getItem(CLICK_KEY(path)) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function incClickCount(path: string): number {
  const next = getClickCount(path) + 1;
  try {
    localStorage.setItem(CLICK_KEY(path), String(next));
  } catch {}
  return next;
}

function AgentStatusDot({
  online,
  opener,
}: {
  online: boolean | undefined;
  opener?: string | null;
}) {
  if (online === undefined) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Circle className="h-2 w-2 fill-muted-foreground animate-pulse" />
        检查中…
      </span>
    );
  }
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${online ? "text-green-500" : "text-muted-foreground"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" : "bg-muted-foreground"}`}
      />
      {online ? `agent 运行中${opener ? ` · ${opener}` : ""}` : "agent 未启动"}
    </span>
  );
}

function RepoCard({
  repo,
  path,
  onOpen,
}: {
  repo: string;
  path: string;
  onOpen: (path: string, repo: string) => Promise<void>;
}) {
  const [clicks, setClicks] = useState(() => getClickCount(path));
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onOpen(path, repo);
      const next = incClickCount(path);
      setClicks(next);
    } finally {
      setLoading(false);
    }
  };

  const parts = path.split("/");
  const displayPath = parts.length > 4 ? "…/" + parts.slice(-3).join("/") : path;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="group relative flex flex-col items-start gap-1 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:border-primary/50 hover:bg-accent/30 disabled:opacity-60 disabled:pointer-events-none w-full"
    >
      <span className="font-mono text-sm font-semibold leading-tight">{repo}</span>
      <span className="text-xs text-muted-foreground truncate max-w-full">{displayPath}</span>
      {clicks > 0 && (
        <span className="absolute right-3 top-2.5 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400 ring-1 ring-violet-500/30">
          {clicks}
        </span>
      )}
    </button>
  );
}

function HomePage() {
  const [search, setSearch] = useState("");
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const { data: devicesData = [], isLoading: devicesLoading } = useQuery(
    orpc.devices.list.queryOptions(),
  );

  const { data: agentStatus, refetch: recheckAgent } = useQuery({
    ...orpc.agent.health.queryOptions(),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const openMutation = useMutation(orpc.agent.open.mutationOptions());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devicesData;
    return devicesData.map((root) => ({
      ...root,
      repos: root.repos.filter(
        (r) => r.repo.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
      ),
    }));
  }, [devicesData, search]);

  const visibleRoots = filtered.filter((r) => r.repos.length > 0);
  const totalRepos = devicesData.reduce((n, r) => n + r.repos.length, 0);

  const handleOpen = async (path: string, repo: string) => {
    if (inFlight.current.has(path)) return;
    if (!agentStatus?.online) {
      toast.error("agent 未启动 · 运行 foyer agent start");
      return;
    }
    inFlight.current.add(path);
    try {
      await openMutation.mutateAsync({ path });
      toast.success(`↗ ${repo}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "打开失败";
      toast.error(msg);
      void recheckAgent();
    } finally {
      inFlight.current.delete(path);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <nav className="flex w-56 shrink-0 flex-col gap-1 border-r p-3 pt-4">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Scan Roots
        </div>
        {devicesData.map((root) => (
          <button
            key={root.path}
            onClick={() => setActiveRoot(root.path === activeRoot ? null : root.path)}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent ${activeRoot === root.path ? "bg-accent font-semibold" : ""}`}
          >
            <span className="truncate font-mono">{root.path.replace(/^\/Users\/[^/]+/, "~")}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5">
              {root.repos.length}
            </Badge>
          </button>
        ))}
      </nav>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 border-b px-6 py-3">
          <div className="flex items-center gap-2">
            <FolderSearch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Devices</span>
            <Badge variant="outline" className="text-[10px]">
              {totalRepos}
            </Badge>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 repo… ( / )"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="ml-auto">
            <AgentStatusDot online={agentStatus?.online} opener={agentStatus?.opener} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
          {devicesLoading && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              加载中…
            </div>
          )}

          {!devicesLoading && visibleRoots.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8 opacity-30" />
              <span className="text-sm">{search ? "无匹配结果" : "未找到 repo"}</span>
            </div>
          )}

          {visibleRoots
            .filter((r) => !activeRoot || r.path === activeRoot)
            .map((root) => (
              <section key={root.path} id={`root-${root.path}`}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-mono text-xs font-semibold text-muted-foreground">
                    {root.path.replace(/^\/Users\/[^/]+/, "~")}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {root.repos.length}
                  </Badge>
                </div>
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                  {root.repos.map((repo) => (
                    <RepoCard
                      key={repo.path}
                      repo={repo.repo}
                      path={repo.path}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              </section>
            ))}
        </main>
      </div>
    </div>
  );
}
