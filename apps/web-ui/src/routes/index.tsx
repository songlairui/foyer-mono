import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
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
import { ScrollArea } from "#/components/ui/scroll-area";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
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
  Search,
  FolderOpen,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Route = createFileRoute("/")({ component: HomePage });

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Storage ──────────────────────────────────────────────────────────────────

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
        /* skip */
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

function getClickCount(path: string) {
  try {
    return parseInt(localStorage.getItem(CLICK_PREFIX + path) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}
function incClickCount(path: string) {
  const n = getClickCount(path) + 1;
  try {
    localStorage.setItem(CLICK_PREFIX + path, String(n));
  } catch {}
  return n;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  if (!ms) return "";
  const d = Date.now() - ms;
  if (d < 60_000) return "刚刚";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d`;
  return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const CAT_META: Record<
  Category,
  { icon: React.ReactNode; label: string; color: string; bg: string }
> = {
  goal: {
    icon: <Star className="h-3 w-3" />,
    label: "Goal",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  work: {
    icon: <Briefcase className="h-3 w-3" />,
    label: "工作",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  life: {
    icon: <Home className="h-3 w-3" />,
    label: "生活",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  explore: {
    icon: <Compass className="h-3 w-3" />,
    label: "探索",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
};

// ── FullscreenButton ──────────────────────────────────────────────────────────

function FullscreenButton() {
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const cb = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", cb);
    return () => document.removeEventListener("fullscreenchange", cb);
  }, []);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      onClick={() =>
        full ? void document.exitFullscreen() : void document.documentElement.requestFullscreen()
      }
      title={full ? "退出全屏" : "全屏"}
    >
      {full ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ── RepoCard ──────────────────────────────────────────────────────────────────

interface RepoCardProps {
  repo: Repo;
  tag?: RepoTag;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
  isDragging?: boolean;
  dragOverlay?: boolean;
  showDragHandle?: boolean;
}

function RepoCard({
  repo,
  tag,
  workDirs,
  agentOnline,
  onOpen,
  onTag,
  onAddWorkDir,
  isDragging,
  dragOverlay,
  showDragHandle,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(() => getClickCount(repo.path));
  const parts = repo.path.split("/");
  const displayPath = parts.length > 4 ? "…/" + parts.slice(-3).join("/") : repo.path;

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || !agentOnline) {
      if (!agentOnline) toast.error("agent 未启动 · foyer agent start");
      return;
    }
    setLoading(true);
    try {
      await onOpen(repo.path);
      setClicks(incClickCount(repo.path));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card px-4 pt-3 pb-2.5 transition-all hover:border-border/80 hover:bg-accent/10",
        isDragging && !dragOverlay && "opacity-50",
        dragOverlay && "opacity-90 cursor-grabbing shadow-2xl",
      )}
      style={dragOverlay ? { transform: "rotate(1deg)" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
          )}
          <span className="font-mono text-sm font-semibold leading-tight break-all min-w-0">
            {repo.repo}
          </span>
        </div>
        {tag && (
          <span
            className={`shrink-0 flex items-center gap-1 text-[10px] ${CAT_META[tag.category].color}`}
          >
            {CAT_META[tag.category].icon}
            {tag.category === "work" && tag.workDir ? tag.workDir : CAT_META[tag.category].label}
          </span>
        )}
      </div>

      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

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

// ── Sortable Repo Card for Left Pane ──────────────────────────────────────────

interface SortableRepoCardProps extends RepoCardProps {
  id: string;
}

function SortableRepoCard({ id, ...props }: SortableRepoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <RepoCard {...props} isDragging={isDragging} />
      <div className="absolute inset-0 z-10" {...attributes} {...listeners} />
    </div>
  );
}

// ── Category Pane ─────────────────────────────────────────────────────────────

interface CategoryPaneProps {
  category: Category;
  workDir?: string;
  repos: Repo[];
  tags: Record<string, RepoTag>;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
  isOver?: boolean;
}

function CategoryPane({
  category,
  workDir,
  repos,
  tags,
  workDirs,
  agentOnline,
  onOpen,
  onTag,
  onAddWorkDir,
  isOver,
}: CategoryPaneProps) {
  const meta = CAT_META[category];
  const label = workDir ?? meta.label;
  const ids = repos.map((r) => r.path);

  return (
    <div
      className={cn(
        "flex-1 min-w-0 border rounded-xl p-4 transition-all",
        isOver ? "border-ring/50 bg-ring/5" : "border-border/30 bg-card/30",
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("p-1.5 rounded-md", meta.bg)}>{meta.icon}</div>
        <span className={cn("text-xs font-semibold uppercase tracking-wide", meta.color)}>
          {label}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">
          {repos.length}
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100%-40px)]">
        {repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-1 text-muted-foreground/40 text-xs">
            <p>拖入项目</p>
          </div>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pr-2">
              {repos.map((repo) => (
                <SortableRepoCard
                  key={repo.path}
                  id={repo.path}
                  repo={repo}
                  tag={tags[repo.path]}
                  workDirs={workDirs}
                  agentOnline={agentOnline}
                  onOpen={onOpen}
                  onTag={onTag}
                  onAddWorkDir={onAddWorkDir}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </ScrollArea>
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────────────

function HomePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const [tags, setTagsState] = useState<Record<string, RepoTag>>(readAllTags);
  const [workDirs, setWorkDirsState] = useState<string[]>(readWorkDirs);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const devicesQueryOptions = orpc.devices.list.queryOptions();
  const {
    data: devicesData = [],
    isLoading: devicesLoading,
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

  const handleTag = useCallback((path: string, tag: RepoTag | null) => {
    writeTag(path, tag);
    setTagsState(readAllTags());
  }, []);

  const handleAddWorkDir = useCallback((dir: string) => {
    setWorkDirsState((prev) => {
      const n = prev.includes(dir) ? prev : [...prev, dir];
      writeWorkDirs(n);
      return n;
    });
  }, []);

  // Filtered repos for right panel (search only)
  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRepos;
    return allRepos.filter(
      (r) =>
        r.repo.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [allRepos, search]);

  // Left panes grouped
  const leftGroups = useMemo(() => {
    const result: Array<{ category: Category; workDir?: string; repos: Repo[]; id: string }> = [];
    const catGroups = new Map<string, Repo[]>();
    for (const [path, tag] of Object.entries(tags)) {
      const repo = allRepos.find((r) => r.path === path);
      if (!repo) continue;
      const key = tag.category === "work" && tag.workDir ? `work::${tag.workDir}` : tag.category;
      const list = catGroups.get(key) ?? [];
      list.push(repo);
      catGroups.set(key, list);
    }
    // Goal
    const goalRepos = catGroups.get("goal") ?? [];
    result.push({ category: "goal", repos: goalRepos, id: "pane-goal" });
    // Work + sub-dirs
    const workRepos = catGroups.get("work") ?? [];
    if (workRepos.length) result.push({ category: "work", repos: workRepos, id: "pane-work" });
    for (const dir of workDirs) {
      const sub = catGroups.get(`work::${dir}`);
      if (sub?.length)
        result.push({ category: "work", workDir: dir, repos: sub, id: `pane-work-${dir}` });
    }
    // Life
    const lifeRepos = catGroups.get("life") ?? [];
    result.push({ category: "life", repos: lifeRepos, id: "pane-life" });
    // Explore
    const exploreRepos = catGroups.get("explore") ?? [];
    result.push({ category: "explore", repos: exploreRepos, id: "pane-explore" });
    return result;
  }, [tags, allRepos, workDirs]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: over a pane id (starts with "pane-")
    if (overId.startsWith("pane-")) {
      // Parse target from pane id
      // format: pane-goal, pane-work, pane-work-dirName, pane-life, pane-explore
      const parts = overId.split("-");
      const targetCategory = parts[1] as Category;
      const targetWorkDir =
        parts[0] === "pane" && parts[1] === "work" && parts.length > 2
          ? parts.slice(2).join("-")
          : undefined;

      const repo = allRepos.find((r) => r.path === activeId);
      if (repo) {
        handleTag(activeId, { category: targetCategory, workDir: targetWorkDir });
      }
    }

    setActiveId(null);
    setOverId(null);
  };

  // Find active repo
  const activeRepo = activeId ? allRepos.find((r) => r.path === activeId) : null;

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
          <FullscreenButton />
        </div>
      </header>

      {/* ── Body ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden p-4 gap-4">
          {/* ── Left: Category Panels (60%) ── */}
          <div className="flex-[3] min-w-0 flex flex-col gap-4">
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-4 pr-2">
                {leftGroups.map((group) => (
                  <CategoryPane
                    key={group.id}
                    category={group.category}
                    workDir={group.workDir}
                    repos={group.repos}
                    tags={tags}
                    workDirs={workDirs}
                    agentOnline={agentStatus?.online ?? false}
                    onOpen={handleOpen}
                    onTag={handleTag}
                    onAddWorkDir={handleAddWorkDir}
                    isOver={overId === group.id}
                  />
                ))}
                {/* Show placeholders if empty */}
                {leftGroups.length === 0 && (
                  <>
                    {["goal", "work", "life", "explore"].map((cat) => (
                      <CategoryPane
                        key={`placeholder-${cat}`}
                        category={cat as Category}
                        repos={[]}
                        tags={{}}
                        workDirs={workDirs}
                        agentOnline={false}
                        onOpen={async () => {}}
                        onTag={() => {}}
                        onAddWorkDir={() => {}}
                        isOver={overId === `pane-${cat}`}
                      />
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ── Right: Repo List (40%) ── */}
          <div className="flex-[2] min-w-0 border border-border/30 rounded-xl bg-card/20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <span className="text-xs font-semibold text-muted-foreground">全部项目</span>
              <Badge variant="outline" className="text-[10px] px-1.5">
                {filteredRepos.length}
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100%-48px)]">
              {devicesLoading && (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  加载中…
                </div>
              )}

              {!devicesLoading && filteredRepos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <FolderOpen className="h-8 w-8 opacity-30" />
                  <span className="text-sm">{search ? "无匹配结果" : "未找到 repo"}</span>
                </div>
              )}

              <SortableContext
                items={filteredRepos.map((r) => r.path)}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-4 space-y-2">
                  {filteredRepos.map((repo) => (
                    <div key={repo.path} className="relative group">
                      {/* Overlay for drag handle */}
                      <div className="absolute inset-0 z-10" />
                      <RepoCard
                        repo={repo}
                        tag={tags[repo.path]}
                        workDirs={workDirs}
                        agentOnline={agentStatus?.online ?? false}
                        onOpen={handleOpen}
                        onTag={handleTag}
                        onAddWorkDir={handleAddWorkDir}
                        showDragHandle
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </ScrollArea>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeRepo ? (
            <RepoCard
              repo={activeRepo}
              tag={tags[activeRepo.path]}
              workDirs={workDirs}
              agentOnline={agentStatus?.online ?? false}
              onOpen={async () => {}}
              onTag={() => {}}
              onAddWorkDir={() => {}}
              dragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
