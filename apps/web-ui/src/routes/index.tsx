import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "#/orpc/client";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { FolderSearch, Circle, RefreshCw, Search } from "lucide-react";
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
  useDroppable,
} from "@dnd-kit/core";

// Import our components
import { FullscreenButton } from "#/components/home/FullscreenButton";
import { RepoCard } from "#/components/home/RepoCard";
import { CategoryPane } from "#/components/home/CategoryPane";
import { DraggableRepoCard, type RepoDragSource } from "#/components/home/DraggableRepoCard";
import type { Repo, RepoTag, Category } from "#/components/home/types";
import { readAllTags, writeTag, readWorkDirs, writeWorkDirs } from "#/components/home/storage";

export const Route = createFileRoute("/")({ component: HomePage });

const REPO_LIST_DROP_ID = "repo-list-drop";

type ActiveDrag = {
  path: string;
  source: RepoDragSource;
};

type DropData =
  | { type: "categoryPane"; category: Category; workDir?: string; paneId: string }
  | { type: "repoList" };

function sameTag(a: RepoTag | undefined, b: RepoTag | null) {
  if (!a || !b) return !a && !b;
  return a.category === b.category && a.workDir === b.workDir;
}

function RepoListDropArea({
  categoryDragActive,
  children,
}: {
  categoryDragActive: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: REPO_LIST_DROP_ID,
    data: { type: "repoList" } satisfies DropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-2 min-w-0 border rounded-xl w-[40%] flex flex-col overflow-hidden transition-colors ${
        categoryDragActive && isOver
          ? "border-ring/60 bg-ring/10"
          : "border-border/30 bg-card/20"
      }`}
    >
      {children}
    </div>
  );
}

function HomePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const [tags, setTagsState] = useState<Record<string, RepoTag>>(readAllTags);
  const [workDirs, setWorkDirsState] = useState<string[]>(readWorkDirs);

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

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
  const visibleDeviceGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    return devicesData
      .map((root) => ({
        ...root,
        repos: root.repos.filter((repo) => {
          if (tags[repo.path]) return false;
          if (!q) return true;

          return (
            repo.repo.toLowerCase().includes(q) ||
            repo.path.toLowerCase().includes(q) ||
            (repo.description?.toLowerCase().includes(q) ?? false)
          );
        }),
      }))
      .filter((root) => root.repos.length > 0);
  }, [devicesData, search, tags]);

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

  // Left panes grouped - 始终显示4个主分组，工作分组再显示子方向
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
  }, [tags, allRepos, workDirs]);

  // Scroll to section on right side
  const scrollToSection = (path: string) => {
    const section = sectionRefs.current[path];
    const container = mainScrollRef.current;
    if (!section || !container) return;
    const offset =
      section.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      8;
    container.scrollTo({ top: offset, behavior: "smooth" });
  };

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖拽一点距离才开始，这样点击就不会被误触
      },
    }),
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Partial<ActiveDrag> | undefined;
    setActiveDrag({
      path: data?.path ?? String(event.active.id),
      source: data?.source ?? "catalog",
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current as Partial<ActiveDrag> | undefined;
    const activePath = activeData?.path ?? activeDrag?.path ?? String(active.id);
    const activeSource = activeData?.source ?? activeDrag?.source ?? "catalog";

    if (!over) {
      setActiveDrag(null);
      return;
    }

    const overData = over.data.current as DropData | undefined;
    let targetTag: RepoTag | null = null;
    let shouldUpdate = false;

    if (overData?.type === "categoryPane") {
      targetTag = { category: overData.category, workDir: overData.workDir };
      shouldUpdate = !sameTag(tags[activePath], targetTag);
    } else if (overData?.type === "repoList" && activeSource === "category") {
      targetTag = null;
      shouldUpdate = Boolean(tags[activePath]);
    }

    const repoExists = allRepos.some((r) => r.path === activePath);
    if (repoExists && shouldUpdate) {
      handleTag(activePath, targetTag);
    }

    setActiveDrag(null);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDrag(null);
  };

  // Find active repo
  const activeRepo = activeDrag ? allRepos.find((r) => r.path === activeDrag.path) : null;

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
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1 overflow-hidden p-4 gap-4">
          {/* ── Left: Category Panels (60%) ── */}
          <div className="flex-3 flex min-h-0 min-w-0 flex-col gap-4 w-[60%]">
            <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-4 overflow-hidden">
              {leftGroups.map((group) => (
                <CategoryPane
                  key={group.id}
                  id={group.id}
                  category={group.category}
                  workDir={group.workDir}
                  repos={group.repos}
                  tags={tags}
                  workDirs={workDirs}
                  agentOnline={agentStatus?.online ?? false}
                  onOpen={handleOpen}
                  onTag={handleTag}
                  onAddWorkDir={handleAddWorkDir}
                />
              ))}
            </div>
          </div>

          {/* ── Right: Repo List (40%) ── */}
          <RepoListDropArea categoryDragActive={activeDrag?.source === "category"}>
            {/* Anchor tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30 shrink-0 flex-wrap">
              {devicesData.map((root) => (
                <Button
                  key={root.path}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => scrollToSection(root.path)}
                >
                  <span className="font-mono">{root.path.replace(/^\/Users\/[^/]+/, "~")}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {root.repos.filter((repo) => !tags[repo.path]).length}
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Scrollable grid */}
            <ScrollArea viewportRef={mainScrollRef} className="flex-1 min-h-0">
              <div className="p-4 space-y-8">
                {devicesLoading && (
                  <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                    加载中…
                  </div>
                )}

                {/* 显示过滤后的分组 */}
                {(() => {
                  if (!devicesLoading && visibleDeviceGroups.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                        <span className="text-sm">
                          {search ? "无未分类匹配结果" : "没有未分类 repo"}
                        </span>
                      </div>
                    );
                  }

                  return visibleDeviceGroups.map((root) => (
                    <section
                      key={root.path}
                      ref={(el) => {
                        sectionRefs.current[root.path] = el;
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2 sticky top-0 bg-card/90 backdrop-blur-md z-50 py-2">
                        <h2 className="font-mono text-xs font-semibold text-muted-foreground">
                          {root.path.replace(/^\/Users\/[^/]+/, "~")}
                        </h2>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {root.repos.length}
                        </Badge>
                      </div>
                      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                        {root.repos.map((repo) => (
                          <DraggableRepoCard
                            key={repo.path}
                            source="catalog"
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
                  ));
                })()}
              </div>
            </ScrollArea>
          </RepoListDropArea>
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
