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
import { RepoCard } from "#/components/home/RepoCard";
import { ScrollArea } from "#/components/ui/scroll-area";
import type { Repo, RepoTag, CategoryDef } from "#/components/home/types";
import { readAllTags, readCategories } from "#/components/home/storage";
import { useChat } from "#/components/chat/ChatContext";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const [tags, setTags] = useState<Record<string, RepoTag>>({});
  const [categories, setCategories] = useState<CategoryDef[]>([]);

  // 仅在客户端加载 localStorage 数据，避免 SSR hydration mismatch
  useEffect(() => {
    setTags(readAllTags());
    setCategories(readCategories());
  }, []);
  const [ungroupedSearch, setUngroupedSearch] = useState("");

  const { setPageContext } = useChat();
  useEffect(() => {
    setPageContext({ route: "/", title: "Foyer 仪表盘" });
  }, [setPageContext]);

  // Lock body scroll on this page
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

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
      // 输入元素内不拦截 / 键
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement)?.isContentEditable) return;

      if (e.key === "/") {
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

  const leftGroups = useMemo(() => {
    const result: Array<{
      category: CategoryDef;
      subCategory?: string;
      repos: Repo[];
      id: string;
    }> = [];
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
      const key = tag.subCategory ? `${tag.categoryId}::${tag.subCategory}` : tag.categoryId;
      const list = catGroups.get(key) ?? [];
      list.push(repo);
      catGroups.set(key, list);
    }

    for (const cat of categories) {
      result.push({
        category: cat,
        repos: catGroups.get(cat.id) ?? [],
        id: `pane-${cat.id}`,
      });
      for (const sub of cat.subCategories) {
        result.push({
          category: cat,
          subCategory: sub,
          repos: catGroups.get(`${cat.id}::${sub}`) ?? [],
          id: `pane-${cat.id}-${sub}`,
        });
      }
    }

    return result;
  }, [tags, allRepos, categories, search]);

  const ungroupedRepos = useMemo(() => {
    const q = ungroupedSearch.trim().toLowerCase();
    return allRepos.filter((repo) => {
      if (tags[repo.path]) return false;
      if (!q) return true;
      return (
        repo.repo.toLowerCase().includes(q) ||
        repo.path.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allRepos, tags, ungroupedSearch]);

  const cacheAge = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 60_000) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-black text-foreground">
      {/* ── 主内容区：header + body ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
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
                  subCategory={group.subCategory}
                  repos={group.repos}
                  agentOnline={agentStatus?.online ?? false}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 未分组 repos 列 ── */}
      <div className="flex h-screen w-72 shrink-0 flex-col overflow-hidden border-l border-border/30 bg-card/10">
        <div className="shrink-0 p-3 border-b border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              未分组
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">
              {ungroupedRepos.length}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={ungroupedSearch}
              onChange={(e) => setUngroupedSearch(e.target.value)}
              placeholder="搜索…"
              className="pl-8 h-8 text-xs bg-transparent"
            />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block [&>div]:w-full">
          <div className="grid grid-cols-1 gap-1.5 p-2">
            {ungroupedRepos.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/40">
                {ungroupedSearch ? "无匹配结果" : "全部已分组"}
              </div>
            ) : (
              ungroupedRepos.map((repo) => (
                <RepoCard
                  key={repo.path}
                  repo={repo}
                  agentOnline={agentStatus?.online ?? false}
                  onOpen={handleOpen}
                  compact
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
