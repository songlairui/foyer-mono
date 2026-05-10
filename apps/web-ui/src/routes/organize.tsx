import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowLeft, FolderSearch, GripVertical, Search, Tags } from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { ScrollArea } from "#/components/ui/scroll-area";
import { orpc } from "#/orpc/client";
import { readAllTags, readWorkDirs, writeTag } from "#/components/home/storage";
import type { Category, Repo, RepoTag } from "#/components/home/types";
import { CAT_META } from "#/components/home/utils";

export const Route = createFileRoute("/organize")({ component: OrganizePage });

type DragSource = "catalog" | "category";

type ActiveDrag = {
  anchorPath: string;
  paths: string[];
};

type DragData = {
  path: string;
  source: DragSource;
};

type DropData =
  | { type: "category"; category: Category; workDir?: string }
  | { type: "unclassified" };

type MarqueeBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type RegisteredTile = {
  node: HTMLElement;
  source: DragSource;
};

type SortMode = "modified-desc" | "modified-asc" | "name-asc" | "name-desc";

type RepoGroup = {
  path: string;
  repos: Repo[];
};

const SORT_LABELS: Record<SortMode, string> = {
  "modified-desc": "最近更新",
  "modified-asc": "最久未动",
  "name-asc": "名称 A-Z",
  "name-desc": "名称 Z-A",
};

function dragId(source: DragSource, path: string) {
  return `${source}:${path}`;
}

function sameTag(a: RepoTag | undefined, b: RepoTag | null) {
  if (!a || !b) return !a && !b;
  return a.category === b.category && a.workDir === b.workDir;
}

function compactPath(path: string) {
  return path.replace(/^\/Users\/[^/]+/, "~");
}

function sortRepos(repos: Repo[], sortMode: SortMode) {
  return [...repos].sort((a, b) => {
    if (sortMode === "name-asc" || sortMode === "name-desc") {
      const result = a.repo.localeCompare(b.repo, "zh-CN", { numeric: true });
      return sortMode === "name-asc" ? result : -result;
    }

    const aTime = a.lastModified ?? 0;
    const bTime = b.lastModified ?? 0;
    return sortMode === "modified-desc" ? bTime - aTime : aTime - bTime;
  });
}

function normalizeBox(box: MarqueeBox) {
  return {
    left: Math.min(box.startX, box.currentX),
    right: Math.max(box.startX, box.currentX),
    top: Math.min(box.startY, box.currentY),
    bottom: Math.max(box.startY, box.currentY),
  };
}

function rectsIntersect(a: DOMRect, b: ReturnType<typeof normalizeBox>) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function RepoTileView({
  repo,
  tag,
  isDragging,
  isSelected,
}: {
  repo: Repo;
  tag?: RepoTag;
  isDragging?: boolean;
  isSelected?: boolean;
}) {
  return (
    <div
      className={`group flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 transition-colors ${
        isDragging ? "opacity-35" : "hover:border-border/80 hover:bg-accent/10"
      } ${isSelected ? "border-ring/70 bg-ring/10 ring-1 ring-ring/40" : ""}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs font-semibold">{repo.repo}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground/55">
          {compactPath(repo.path)}
        </div>
      </div>
      {tag ? (
        <span className={`shrink-0 text-[10px] ${CAT_META[tag.category].color}`}>
          {tag.category === "work" && tag.workDir ? tag.workDir : CAT_META[tag.category].label}
        </span>
      ) : null}
    </div>
  );
}

function DraggableRepoTile({
  repo,
  source,
  tag,
  isSelected,
  onToggle,
  registerTile,
}: {
  repo: Repo;
  source: DragSource;
  tag?: RepoTag;
  isSelected: boolean;
  onToggle: (path: string) => void;
  registerTile: (path: string, source: DragSource, node: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(source, repo.path),
    data: { path: repo.path, source } satisfies DragData,
  });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      registerTile(repo.path, source, node);
    },
    [registerTile, repo.path, setNodeRef, source],
  );

  return (
    <div
      ref={setRefs}
      data-repo-tile
      {...attributes}
      {...listeners}
      onClick={() => onToggle(repo.path)}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      <RepoTileView repo={repo} tag={tag} isDragging={isDragging} isSelected={isSelected} />
    </div>
  );
}

function CategoryDropPane({
  id,
  category,
  workDir,
  repos,
  tags,
  selectedPaths,
  onToggle,
  registerTile,
  onMarqueeStart,
  onMarqueeMove,
  onMarqueeEnd,
}: {
  id: string;
  category: Category;
  workDir?: string;
  repos: Repo[];
  tags: Record<string, RepoTag>;
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  registerTile: (path: string, source: DragSource, node: HTMLElement | null) => void;
  onMarqueeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onMarqueeMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onMarqueeEnd: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const meta = CAT_META[category];
  const label = workDir ?? meta.label;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "category", category, workDir } satisfies DropData,
  });

  return (
    <section
      ref={setNodeRef}
      onPointerDown={onMarqueeStart}
      onPointerMove={onMarqueeMove}
      onPointerUp={onMarqueeEnd}
      onPointerCancel={onMarqueeEnd}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border p-3 transition-colors ${
        isOver ? "border-ring/60 bg-ring/10" : "border-border/30 bg-card/30"
      }`}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <div className={`rounded-md p-1.5 ${meta.bg}`}>{meta.icon}</div>
        <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
          {label}
        </span>
        <Badge variant="outline" className="ml-auto px-1.5 text-[10px]">
          {repos.length}
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {repos.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground/40">
            拖入项目
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 pr-2">
            {repos.map((repo) => (
              <DraggableRepoTile
                key={repo.path}
                repo={repo}
                source="category"
                tag={tags[repo.path]}
                isSelected={selectedPaths.has(repo.path)}
                onToggle={onToggle}
                registerTile={registerTile}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

function UnclassifiedPane({
  groups,
  count,
  tags,
  selectedPaths,
  onToggle,
  registerTile,
  onMarqueeStart,
  onMarqueeMove,
  onMarqueeEnd,
}: {
  groups: RepoGroup[];
  count: number;
  tags: Record<string, RepoTag>;
  selectedPaths: Set<string>;
  onToggle: (path: string) => void;
  registerTile: (path: string, source: DragSource, node: HTMLElement | null) => void;
  onMarqueeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onMarqueeMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onMarqueeEnd: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unclassified",
    data: { type: "unclassified" } satisfies DropData,
  });

  return (
    <section
      ref={setNodeRef}
      onPointerDown={onMarqueeStart}
      onPointerMove={onMarqueeMove}
      onPointerUp={onMarqueeEnd}
      onPointerCancel={onMarqueeEnd}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border transition-colors ${
        isOver ? "border-ring/60 bg-ring/10" : "border-border/30 bg-card/20"
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-4 py-2">
        <span className="text-xs font-semibold text-muted-foreground">未分类</span>
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          {count}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-3">
          {groups.map((group) => (
            <section key={group.path}>
              <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-card/95 py-1 backdrop-blur">
                <span className="truncate font-mono text-xs font-semibold text-muted-foreground">
                  {compactPath(group.path)}
                </span>
                <Badge variant="secondary" className="px-1.5 text-[10px]">
                  {group.repos.length}
                </Badge>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
                {group.repos.map((repo) => (
                  <DraggableRepoTile
                    key={repo.path}
                    repo={repo}
                    source="catalog"
                    tag={tags[repo.path]}
                    isSelected={selectedPaths.has(repo.path)}
                    onToggle={onToggle}
                    registerTile={registerTile}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function DragPreview({ repos, tags }: { repos: Repo[]; tags: Record<string, RepoTag> }) {
  if (repos.length === 1 && repos[0]) {
    return <RepoTileView repo={repos[0]} tag={tags[repos[0].path]} isSelected />;
  }

  return (
    <div className="w-64 rounded-lg border border-ring/50 bg-card px-3 py-2 shadow-2xl">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Tags className="h-3.5 w-3.5 text-primary" />
        {repos.length} 个 repo
      </div>
      <div className="mt-1 space-y-0.5">
        {repos.slice(0, 3).map((repo) => (
          <div key={repo.path} className="truncate font-mono text-[10px] text-muted-foreground">
            {repo.repo}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarqueeOverlay({ box }: { box: MarqueeBox }) {
  const rect = normalizeBox(box);
  return (
    <div
      className="pointer-events-none fixed z-50 border border-ring/70 bg-ring/15"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      }}
    />
  );
}

function OrganizePage() {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("modified-desc");
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const marqueePointerId = useRef<number | null>(null);
  const marqueeBaseSelection = useRef<Set<string>>(new Set());
  const tileRefs = useRef<Map<string, RegisteredTile>>(new Map());
  const [tags, setTagsState] = useState<Record<string, RepoTag>>(readAllTags);
  const workDirs = useMemo(readWorkDirs, []);

  const { data: devicesData = [], isLoading } = useQuery({
    ...orpc.devices.list.queryOptions(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const allRepos = useMemo(() => devicesData.flatMap((root) => root.repos), [devicesData]);
  const repoByPath = useMemo(() => new Map(allRepos.map((repo) => [repo.path, repo])), [allRepos]);

  const leftGroups = useMemo(() => {
    const grouped = new Map<string, Repo[]>();
    for (const [path, tag] of Object.entries(tags)) {
      const repo = repoByPath.get(path);
      if (!repo) continue;
      const key = tag.category === "work" && tag.workDir ? `work::${tag.workDir}` : tag.category;
      const repos = grouped.get(key) ?? [];
      repos.push(repo);
      grouped.set(key, repos);
    }

    const result: Array<{ id: string; category: Category; workDir?: string; repos: Repo[] }> = [
      { id: "pane-goal", category: "goal", repos: sortRepos(grouped.get("goal") ?? [], sortMode) },
      { id: "pane-work", category: "work", repos: sortRepos(grouped.get("work") ?? [], sortMode) },
    ];

    for (const dir of workDirs) {
      result.push({
        id: `pane-work-${dir}`,
        category: "work",
        workDir: dir,
        repos: sortRepos(grouped.get(`work::${dir}`) ?? [], sortMode),
      });
    }

    result.push(
      { id: "pane-life", category: "life", repos: sortRepos(grouped.get("life") ?? [], sortMode) },
      {
        id: "pane-explore",
        category: "explore",
        repos: sortRepos(grouped.get("explore") ?? [], sortMode),
      },
    );

    return result;
  }, [repoByPath, sortMode, tags, workDirs]);

  const unclassifiedGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devicesData
      .map((root) => ({
        path: root.path,
        repos: sortRepos(
          root.repos.filter((repo) => {
            if (tags[repo.path]) return false;
            if (!q) return true;
            return (
              repo.repo.toLowerCase().includes(q) ||
              repo.path.toLowerCase().includes(q) ||
              (repo.description?.toLowerCase().includes(q) ?? false)
            );
          }),
          sortMode,
        ),
      }))
      .filter((group) => group.repos.length > 0);
  }, [devicesData, search, sortMode, tags]);

  const unclassifiedRepos = useMemo(
    () => unclassifiedGroups.flatMap((group) => group.repos),
    [unclassifiedGroups],
  );

  const activeRepos = useMemo(() => {
    if (!activeDrag) return [];
    return activeDrag.paths
      .map((path) => repoByPath.get(path))
      .filter((repo): repo is Repo => Boolean(repo));
  }, [activeDrag, repoByPath]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const registerTile = useCallback((path: string, source: DragSource, node: HTMLElement | null) => {
    if (node) tileRefs.current.set(path, { node, source });
    else tileRefs.current.delete(path);
  }, []);

  const toggleSelection = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const selectVisibleUnclassified = useCallback(() => {
    setSelectedPaths(new Set(unclassifiedRepos.map((repo) => repo.path)));
  }, [unclassifiedRepos]);

  const updateSelectionFromMarquee = useCallback((box: MarqueeBox) => {
    const rect = normalizeBox(box);
    const next = new Set(marqueeBaseSelection.current);

    for (const [path, tile] of tileRefs.current) {
      if (rectsIntersect(tile.node.getBoundingClientRect(), rect)) {
        next.add(path);
      }
    }

    setSelectedPaths(next);
  }, []);

  const startMarquee = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("[data-repo-tile]")) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      marqueePointerId.current = event.pointerId;
      marqueeBaseSelection.current =
        event.metaKey || event.ctrlKey || event.shiftKey ? new Set(selectedPaths) : new Set();

      const box = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      };
      setMarquee(box);
      updateSelectionFromMarquee(box);
    },
    [selectedPaths, updateSelectionFromMarquee],
  );

  const moveMarquee = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (marqueePointerId.current !== event.pointerId || !marquee) return;
      const next = { ...marquee, currentX: event.clientX, currentY: event.clientY };
      setMarquee(next);
      updateSelectionFromMarquee(next);
    },
    [marquee, updateSelectionFromMarquee],
  );

  const endMarquee = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (marqueePointerId.current !== event.pointerId) return;
    marqueePointerId.current = null;
    marqueeBaseSelection.current = new Set();
    setMarquee(null);
  }, []);

  const writeRepoTags = useCallback(
    (paths: string[], tag: RepoTag | null) => {
      let changed = false;
      for (const path of paths) {
        if (!repoByPath.has(path) || sameTag(tags[path], tag)) continue;
        writeTag(path, tag);
        changed = true;
      }
      if (!changed) return;
      setTagsState(readAllTags());
      setSelectedPaths(new Set());
    },
    [repoByPath, tags],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Partial<DragData> | undefined;
    const path = data?.path ?? String(event.active.id);
    const paths = selectedPaths.has(path) ? Array.from(selectedPaths) : [path];
    setActiveDrag({ anchorPath: path, paths });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Partial<DragData> | undefined;
    const path = data?.path ?? activeDrag?.anchorPath ?? String(event.active.id);
    const paths = activeDrag?.paths ?? [path];
    const drop = event.over?.data.current as DropData | undefined;

    if (drop?.type === "category") {
      writeRepoTags(paths, { category: drop.category, workDir: drop.workDir });
    } else if (drop?.type === "unclassified") {
      writeRepoTags(paths, null);
    }

    setActiveDrag(null);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDrag(null);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/30 bg-black/95 px-5 py-2.5">
        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
          <Link to="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
        </Button>
        <div className="flex shrink-0 items-center gap-2">
          <FolderSearch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Foyer 整理</span>
          <Badge variant="outline" className="px-1.5 text-[10px]">
            {allRepos.length}
          </Badge>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="筛选未分类 repo"
            className="h-8 bg-transparent pl-8 text-xs"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border/30 p-0.5">
          {(Object.entries(SORT_LABELS) as Array<[SortMode, string]>).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              size="xs"
              variant={sortMode === mode ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setSortMode(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tags className="h-3.5 w-3.5" />
          {selectedPaths.size > 0 ? `已选 ${selectedPaths.size}` : "拖到左侧归类，拖回右侧取消"}
          {selectedPaths.size > 0 ? (
            <Button size="xs" variant="ghost" className="h-6 px-2" onClick={clearSelection}>
              清空
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-2"
            onClick={selectVisibleUnclassified}
          >
            全选未分类
          </Button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] gap-4 overflow-hidden p-4">
          <div className="grid min-h-0 grid-cols-2 auto-rows-fr gap-4 overflow-hidden">
            {leftGroups.map((group) => (
              <CategoryDropPane
                key={group.id}
                id={group.id}
                category={group.category}
                workDir={group.workDir}
                repos={group.repos}
                tags={tags}
                selectedPaths={selectedPaths}
                onToggle={toggleSelection}
                registerTile={registerTile}
                onMarqueeStart={startMarquee}
                onMarqueeMove={moveMarquee}
                onMarqueeEnd={endMarquee}
              />
            ))}
          </div>

          <UnclassifiedPane
            groups={unclassifiedGroups}
            count={unclassifiedRepos.length}
            tags={tags}
            selectedPaths={selectedPaths}
            onToggle={toggleSelection}
            registerTile={registerTile}
            onMarqueeStart={startMarquee}
            onMarqueeMove={moveMarquee}
            onMarqueeEnd={endMarquee}
          />
        </main>

        <DragOverlay>
          {activeRepos.length > 0 ? <DragPreview repos={activeRepos} tags={tags} /> : null}
        </DragOverlay>
      </DndContext>

      {marquee ? <MarqueeOverlay box={marquee} /> : null}

      {isLoading ? (
        <div className="pointer-events-none fixed bottom-4 left-4 rounded-md border border-border/40 bg-card px-3 py-2 text-xs text-muted-foreground">
          加载中…
        </div>
      ) : null}
    </div>
  );
}
