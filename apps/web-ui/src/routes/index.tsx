import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { FolderSearch, Circle, RefreshCw, Search, Tags } from "lucide-react";

// Import our components
import { FullscreenButton } from "#/components/home/FullscreenButton";
import { CategoryPane } from "#/components/home/CategoryPane";
import type { Repo, RepoTag, Category } from "#/components/home/types";
import { readAllTags, readWorkDirs } from "#/components/home/storage";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const [tags] = useState<Record<string, RepoTag>>(readAllTags);
  const [workDirs] = useState<string[]>(readWorkDirs);

  const devicesQueryOptions = orpc.devices.list.queryOptions();
  const {
    data: devicesData = [],
    isFetching,
    dataUpdatedAt,
  } = useQuery({ ...devicesQueryOptions, staleTime: 5 * 60_000, gcTime: 10 * 60_000 });

  const { data: agentStatus, refetch: recheckAgent } = useQuery({
    ...orpc.agent.health.queryOptions(),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
  const openMutation = useMutation(orpc.agent.open.mutationOptions());

  const allRepos = useMemo(() => devicesData.flatMap((r) => r.repos), [devicesData]);

  // keyboard shortcuts
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

  const handleOpen = useCallback(
    async (path: string) => {
      if (inFlight.current.has(path)) return;
      if (!agentStatus?.online) {
        toast.error("agent 未启动 · foyer agent start");
        return;
      }
      inFlight.current.add(path);
      try {
        const repo = allRepos.find((r) => r.path === path);
        await openMutation.mutateAsync({ path });
        toast.success(`↗ ${repo?.repo ?? path}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "打开失败");
        void recheckAgent();
      } finally {
        inFlight.current.delete(path);
      }
    },
    [agentStatus?.online, openMutation, allRepos, recheckAgent],
  );

  // Left panes grouped - 始终显示4个主分组，工作分组再显示子方向
  const leftGroups = useMemo(() => {
    const result: Array<{ category: Category; workDir?: string; repos: Repo[]; id: string }> = [];
    const catGroups = new Map<string, Repo[]>();
    const q = search.trim().toLowerCase();
    for (const [path, tag] of Object.entries(tags)) {
      const repo = allRepos.find((r) => r.path === path);
      if (!repo) continue;
      if (
        q &&
        !repo.repo.toLowerCase().includes(q) &&
        !repo.path.toLowerCase().includes(q) &&
        !(repo.description?.toLowerCase().includes(q) ?? false)
      ) {
        continue;
      }
      const key = tag.category === "work" && tag.workDir ? `work::${tag.workDir}` : tag.category;
      const list = catGroups.get(key) ?? [];
      list.push(repo);
      catGroups.set(key, list);
    }

    // Goal - 始终显示
    result.push({ category: "goal", repos: catGroups.get("goal") ?? [], id: "pane-goal" });

    // Work - 始终显示主分组，然后子方向
    result.push({ category: "work", repos: catGroups.get("work") ?? [], id: "pane-work" });
    for (const dir of workDirs) {
      const sub = catGroups.get(`work::${dir}`);
      result.push({ category: "work", workDir: dir, repos: sub ?? [], id: `pane-work-${dir}` });
    }

    // Life - 始终显示
    result.push({ category: "life", repos: catGroups.get("life") ?? [], id: "pane-life" });

    // Explore - 始终显示
    result.push({ category: "explore", repos: catGroups.get("explore") ?? [], id: "pane-explore" });

    return result;
  }, [tags, allRepos, workDirs, search]);

  const cacheAge = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 60_000) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-foreground">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-border/30 px-5 py-2.5 shrink-0 bg-black/95">
        <div className="flex items-center gap-2 shrink-0">
          <FolderSearch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Foyer</span>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {allRepos.length}
          </Badge>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 repo… ( / )"
            className="pl-8 h-8 text-xs bg-transparent"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Agent status */}
          {agentStatus === undefined ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Circle className="h-2 w-2 fill-muted-foreground animate-pulse" />
              检查中…
            </span>
          ) : (
            <span
              className={`flex items-center gap-1.5 text-xs ${agentStatus.online ? "text-green-500" : "text-muted-foreground"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${agentStatus.online ? "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" : "bg-muted-foreground"}`}
              />
              {agentStatus.online ? `agent · ${agentStatus.opener ?? ""}` : "agent 未启动"}
            </span>
          )}
          {cacheAge !== null && (
            <span className="text-[11px] text-muted-foreground/50">
              {cacheAge === 0 ? "刚更新" : `${cacheAge}m 前`}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: devicesQueryOptions.queryKey })
            }
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1.5">
            <Link to="/organize">
              <Tags className="h-3.5 w-3.5" />
              整理
            </Link>
          </Button>
          <FullscreenButton />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-4 overflow-hidden">
            {leftGroups.map((group) => (
              <CategoryPane
                key={group.id}
                id={group.id}
                category={group.category}
                workDir={group.workDir}
                repos={group.repos}
                agentOnline={agentStatus?.online ?? false}
                onOpen={handleOpen}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
