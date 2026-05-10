import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  FolderOpen,
  Search,
  FolderSearch,
  Star,
  Briefcase,
  Home,
  Compass,
  MoreHorizontal,
  ExternalLink,
  Circle,
  RefreshCw,
  Maximize,
  Minimize,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

// ── Types ───────────────────────────────────────────────────────────────────

interface Repo {
  repo: string;
  path: string;
  scanRoot: string;
  description?: string;
  lane?: string;
  slug?: string;
  lastModified?: number;
}

type Category = "goal" | "work" | "life" | "explore";

interface RepoTag {
  category: Category;
  workDir?: string;
}

type SidebarFilter =
  | { type: "unclassified" }
  | { type: "category"; category: Category; workDir?: string }
  | { type: "scan-root"; path: string };

// ── Storage ─────────────────────────────────────────────────────────────────

const CAT_PREFIX = "foyer.repo.cat.";
const CLICK_PREFIX = "foyer.repo.click.";
const WORK_DIRS_KEY = "foyer.work-dirs";

function readAllTags(): Record<string, RepoTag> {
  const result: Record<string, RepoTag> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CAT_PREFIX)) continue;
      const path = key.slice(CAT_PREFIX.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        result[path] = JSON.parse(raw) as RepoTag;
      } catch {
        /* skip malformed */
      }
    }
  } catch {}
  return result;
}

function writeTag(path: string, tag: RepoTag | null) {
  if (tag === null) localStorage.removeItem(CAT_PREFIX + path);
  else localStorage.setItem(CAT_PREFIX + path, JSON.stringify(tag));
}

function readWorkDirs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WORK_DIRS_KEY) ?? '["方向A","方向B"]') as string[];
  } catch {
    return ["方向A", "方向B"];
  }
}

function writeWorkDirs(dirs: string[]) {
  localStorage.setItem(WORK_DIRS_KEY, JSON.stringify(dirs));
}

function getClickCount(path: string): number {
  try {
    return parseInt(localStorage.getItem(CLICK_PREFIX + path) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function incClickCount(path: string): number {
  const next = getClickCount(path) + 1;
  try {
    localStorage.setItem(CLICK_PREFIX + path, String(next));
  } catch {}
  return next;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const CATEGORY_META: Record<Category, { icon: React.ReactNode; label: string }> = {
  goal: { icon: <Star className="h-3.5 w-3.5" />, label: "Goal" },
  work: { icon: <Briefcase className="h-3.5 w-3.5" />, label: "工作" },
  life: { icon: <Home className="h-3.5 w-3.5" />, label: "生活" },
  explore: { icon: <Compass className="h-3.5 w-3.5" />, label: "探索" },
};

// ── AgentStatusDot ────────────────────────────────────────────────────────────

function AgentStatusDot({
  online,
  opener,
}: {
  online: boolean | undefined;
  opener?: string | null;
}) {
  if (online === undefined)
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Circle className="h-2 w-2 fill-muted-foreground animate-pulse" />
        检查中…
      </span>
    );
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${online ? "text-green-500" : "text-muted-foreground"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]" : "bg-muted-foreground"}`}
      />
      {online ? `agent · ${opener ?? ""}` : "agent 未启动"}
    </span>
  );
}

// ── FullscreenButton ──────────────────────────────────────────────────────────

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      onClick={toggle}
      title={isFullscreen ? "退出全屏" : "全屏"}
    >
      {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ── RepoCard ──────────────────────────────────────────────────────────────────

interface RepoCardProps {
  repo: Repo;
  tag: RepoTag | undefined;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
}

function RepoCard({
  repo,
  tag,
  workDirs,
  agentOnline,
  onOpen,
  onTag,
  onAddWorkDir,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(() => getClickCount(repo.path));

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    if (!agentOnline) {
      toast.error("agent 未启动 · foyer agent start");
      return;
    }
    setLoading(true);
    try {
      await onOpen(repo.path);
      const next = incClickCount(repo.path);
      setClicks(next);
    } finally {
      setLoading(false);
    }
  };

  const parts = repo.path.split("/");
  const displayPath = parts.length > 4 ? "…/" + parts.slice(-3).join("/") : repo.path;

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-xl border bg-card px-4 pt-3 pb-2.5 transition-colors hover:border-border/80 hover:bg-accent/10">
      {/* Title + tag indicator */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold leading-tight break-all">{repo.repo}</span>
        {tag && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
            {CATEGORY_META[tag.category].icon}
            {tag.category === "work" && tag.workDir
              ? tag.workDir
              : CATEGORY_META[tag.category].label}
          </span>
        )}
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

      {/* Path + mtime */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] text-muted-foreground/60 truncate font-mono">
          {displayPath}
        </span>
        {repo.lastModified ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/50">
            {relativeTime(repo.lastModified)}
          </span>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border/30">
        {clicks > 0 && (
          <span className="text-[10px] text-muted-foreground/40 mr-auto">{clicks}×</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleOpen}
            disabled={loading}
          >
            <ExternalLink className="h-3 w-3" />
            打开
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">标记为</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "goal" })}>
                <Star className="h-3.5 w-3.5 mr-2" />
                Goal
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Briefcase className="h-3.5 w-3.5 mr-2" />
                  工作
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  {workDirs.map((dir) => (
                    <DropdownMenuItem
                      key={dir}
                      onClick={() => onTag(repo.path, { category: "work", workDir: dir })}
                    >
                      {dir}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      const dir = prompt("新方向名称")?.trim();
                      if (dir) {
                        onAddWorkDir(dir);
                        onTag(repo.path, { category: "work", workDir: dir });
                      }
                    }}
                  >
                    + 新建方向
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "life" })}>
                <Home className="h-3.5 w-3.5 mr-2" />
                生活
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "explore" })}>
                <Compass className="h-3.5 w-3.5 mr-2" />
                探索
              </DropdownMenuItem>
              {tag && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={() => onTag(repo.path, null)}
                  >
                    移除标记
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────

function HomePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SidebarFilter>({ type: "unclassified" });
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const [tags, setTagsState] = useState<Record<string, RepoTag>>(readAllTags);
  const [workDirs, setWorkDirsState] = useState<string[]>(readWorkDirs);

  // devices data — cached for 5 min, manual refetch via button
  const devicesQueryKey = orpc.devices.list.queryOptions().queryKey;
  const {
    data: devicesData = [],
    isLoading: devicesLoading,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    ...orpc.devices.list.queryOptions(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const handleForceRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: devicesQueryKey });
  }, [queryClient, devicesQueryKey]);

  const { data: agentStatus, refetch: recheckAgent } = useQuery({
    ...orpc.agent.health.queryOptions(),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  const openMutation = useMutation(orpc.agent.open.mutationOptions());

  const allRepos = useMemo(() => devicesData.flatMap((r) => r.repos), [devicesData]);

  // Keyboard shortcuts
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
        const msg = e instanceof Error ? e.message : "打开失败";
        toast.error(msg);
        void recheckAgent();
      } finally {
        inFlight.current.delete(path);
      }
    },
    [agentStatus?.online, openMutation, allRepos, recheckAgent],
  );

  const handleTag = useCallback((path: string, tag: RepoTag | null) => {
    writeTag(path, tag);
    setTagsState(readAllTags());
  }, []);

  const handleAddWorkDir = useCallback((dir: string) => {
    setWorkDirsState((prev) => {
      const next = prev.includes(dir) ? prev : [...prev, dir];
      writeWorkDirs(next);
      return next;
    });
  }, []);

  // Category counts
  const { catCounts, workDirCounts } = useMemo(() => {
    const catCounts = { goal: 0, work: 0, life: 0, explore: 0 } as Record<Category, number>;
    const workDirCounts: Record<string, number> = {};
    for (const tag of Object.values(tags)) {
      catCounts[tag.category]++;
      if (tag.category === "work" && tag.workDir) {
        workDirCounts[tag.workDir] = (workDirCounts[tag.workDir] ?? 0) + 1;
      }
    }
    return { catCounts, workDirCounts };
  }, [tags]);

  const unclassifiedCount = allRepos.filter((r) => !tags[r.path]).length;

  // Filter + search
  const filteredRepos = useMemo(() => {
    let repos = allRepos;
    if (filter.type === "unclassified") {
      repos = repos.filter((r) => !tags[r.path]);
    } else if (filter.type === "category") {
      repos = repos.filter((r) => {
        const tag = tags[r.path];
        if (!tag || tag.category !== filter.category) return false;
        if (filter.workDir) return tag.workDir === filter.workDir;
        return true;
      });
    } else if (filter.type === "scan-root") {
      repos = repos.filter((r) => r.scanRoot === filter.path);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      repos = repos.filter(
        (r) =>
          r.repo.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return repos;
  }, [allRepos, filter, tags, search]);

  // Group by scanRoot for scan-root / unclassified views
  const groupedRepos = useMemo(() => {
    if (filter.type === "category") {
      return [{ groupKey: "", title: "", repos: filteredRepos }];
    }
    const byRoot = new Map<string, Repo[]>();
    for (const r of filteredRepos) {
      const list = byRoot.get(r.scanRoot) ?? [];
      list.push(r);
      byRoot.set(r.scanRoot, list);
    }
    return Array.from(byRoot.entries()).map(([path, repos]) => ({
      groupKey: path,
      title: path.replace(/^\/Users\/[^/]+/, "~"),
      repos,
    }));
  }, [filter, filteredRepos]);

  const isActive = (f: SidebarFilter) => JSON.stringify(filter) === JSON.stringify(f);
  const navCls = (active: boolean) =>
    `w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent cursor-pointer ${active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"}`;

  const cacheAge = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 60_000) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Sidebar ── */}
      <nav className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <FolderSearch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Foyer</span>
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5">
            {allRepos.length}
          </Badge>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* Tagged categories */}
            {(["goal", "work", "life", "explore"] as Category[]).map((cat) => {
              const count = catCounts[cat];
              return (
                <div key={cat}>
                  <button
                    className={navCls(
                      filter.type === "category" && filter.category === cat && !filter.workDir,
                    )}
                    onClick={() => setFilter({ type: "category", category: cat })}
                  >
                    <span className="flex items-center gap-1.5">
                      {CATEGORY_META[cat].icon}
                      {CATEGORY_META[cat].label}
                    </span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {count}
                      </Badge>
                    )}
                  </button>
                  {/* Work sub-dirs */}
                  {cat === "work" &&
                    workDirs
                      .filter((d) => (workDirCounts[d] ?? 0) > 0)
                      .map((dir) => (
                        <button
                          key={dir}
                          className={
                            navCls(
                              filter.type === "category" &&
                                filter.category === "work" &&
                                filter.workDir === dir,
                            ) + " pl-7"
                          }
                          onClick={() =>
                            setFilter({ type: "category", category: "work", workDir: dir })
                          }
                        >
                          <span className="truncate">{dir}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {workDirCounts[dir] ?? 0}
                          </Badge>
                        </button>
                      ))}
                </div>
              );
            })}

            {/* Scan Roots */}
            <div className="pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1.5">
                Scan Roots
              </div>
              {devicesData.map((root) => (
                <button
                  key={root.path}
                  className={navCls(filter.type === "scan-root" && filter.path === root.path)}
                  onClick={() => setFilter({ type: "scan-root", path: root.path })}
                >
                  <span className="truncate font-mono">
                    {root.path.replace(/^\/Users\/[^/]+/, "~")}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5">
                    {root.repos.length}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Unclassified (default) */}
            <button
              className={navCls(isActive({ type: "unclassified" }))}
              onClick={() => setFilter({ type: "unclassified" })}
            >
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                未分类
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {unclassifiedCount}
              </Badge>
            </button>
          </div>
        </ScrollArea>

        {/* Agent status + fullscreen */}
        <div className="border-t px-3 py-2 flex items-center justify-between">
          <AgentStatusDot online={agentStatus?.online} opener={agentStatus?.opener} />
          <FullscreenButton />
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-3 border-b px-5 py-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 repo… ( / )"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {cacheAge !== null && (
              <span className="text-[11px] text-muted-foreground/50">
                {cacheAge === 0 ? "刚刚更新" : `${cacheAge}m 前`}
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleForceRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <main className="px-6 py-4 space-y-8">
            {devicesLoading && (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                加载中…
              </div>
            )}

            {!devicesLoading && filteredRepos.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <FolderOpen className="h-8 w-8 opacity-30" />
                <span className="text-sm">{search ? "无匹配结果" : "暂无项目"}</span>
              </div>
            )}

            {groupedRepos.map((group) => (
              <section key={group.groupKey || "all"}>
                {group.title && (
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="font-mono text-xs font-semibold text-muted-foreground">
                      {group.title}
                    </h2>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {group.repos.length}
                    </Badge>
                  </div>
                )}
                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                  {group.repos.map((repo) => (
                    <RepoCard
                      key={repo.path}
                      repo={repo}
                      tag={tags[repo.path]}
                      workDirs={workDirs}
                      agentOnline={agentStatus?.online ?? false}
                      onOpen={handleOpen}
                      onTag={handleTag}
                      onAddWorkDir={handleAddWorkDir}
                    />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
