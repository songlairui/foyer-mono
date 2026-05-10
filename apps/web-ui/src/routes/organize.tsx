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
import { useMemo, useState } from "react";
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
  path: string;
  source: DragSource;
};

type DropData =
  | { type: "category"; category: Category; workDir?: string }
  | { type: "unclassified" };

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

function RepoTileView({
  repo,
  tag,
  isDragging,
}: {
  repo: Repo;
  tag?: RepoTag;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`group flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-2 transition-colors ${
        isDragging ? "opacity-35" : "hover:border-border/80 hover:bg-accent/10"
      }`}
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
}: {
  repo: Repo;
  source: DragSource;
  tag?: RepoTag;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId(source, repo.path),
    data: { path: repo.path, source } satisfies ActiveDrag,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      <RepoTileView repo={repo} tag={tag} isDragging={isDragging} />
    </div>
  );
}

function CategoryDropPane({
  id,
  category,
  workDir,
  repos,
  tags,
}: {
  id: string;
  category: Category;
  workDir?: string;
  repos: Repo[];
  tags: Record<string, RepoTag>;
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
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

function UnclassifiedPane({ repos, tags }: { repos: Repo[]; tags: Record<string, RepoTag> }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unclassified",
    data: { type: "unclassified" } satisfies DropData,
  });

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border transition-colors ${
        isOver ? "border-ring/60 bg-ring/10" : "border-border/30 bg-card/20"
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-4 py-2">
        <span className="text-xs font-semibold text-muted-foreground">未分类</span>
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          {repos.length}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 p-3">
          {repos.map((repo) => (
            <DraggableRepoTile key={repo.path} repo={repo} source="catalog" tag={tags[repo.path]} />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function OrganizePage() {
  const [search, setSearch] = useState("");
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
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
      { id: "pane-goal", category: "goal", repos: grouped.get("goal") ?? [] },
      { id: "pane-work", category: "work", repos: grouped.get("work") ?? [] },
    ];

    for (const dir of workDirs) {
      result.push({
        id: `pane-work-${dir}`,
        category: "work",
        workDir: dir,
        repos: grouped.get(`work::${dir}`) ?? [],
      });
    }

    result.push(
      { id: "pane-life", category: "life", repos: grouped.get("life") ?? [] },
      { id: "pane-explore", category: "explore", repos: grouped.get("explore") ?? [] },
    );

    return result;
  }, [repoByPath, tags, workDirs]);

  const unclassifiedRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRepos.filter((repo) => {
      if (tags[repo.path]) return false;
      if (!q) return true;
      return (
        repo.repo.toLowerCase().includes(q) ||
        repo.path.toLowerCase().includes(q) ||
        (repo.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allRepos, search, tags]);

  const activeRepo = activeDrag ? repoByPath.get(activeDrag.path) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const writeRepoTag = (path: string, tag: RepoTag | null) => {
    if (!repoByPath.has(path) || sameTag(tags[path], tag)) return;
    writeTag(path, tag);
    setTagsState(readAllTags());
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Partial<ActiveDrag> | undefined;
    setActiveDrag({
      path: data?.path ?? String(event.active.id),
      source: data?.source ?? "catalog",
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as Partial<ActiveDrag> | undefined;
    const path = data?.path ?? activeDrag?.path ?? String(event.active.id);
    const drop = event.over?.data.current as DropData | undefined;

    if (drop?.type === "category") {
      writeRepoTag(path, { category: drop.category, workDir: drop.workDir });
    } else if (drop?.type === "unclassified") {
      writeRepoTag(path, null);
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
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tags className="h-3.5 w-3.5" />
          拖到左侧归类，拖回右侧取消
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
              />
            ))}
          </div>

          <UnclassifiedPane repos={unclassifiedRepos} tags={tags} />
        </main>

        <DragOverlay>
          {activeRepo ? <RepoTileView repo={activeRepo} tag={tags[activeRepo.path]} /> : null}
        </DragOverlay>
      </DndContext>

      {isLoading ? (
        <div className="pointer-events-none fixed bottom-4 left-4 rounded-md border border-border/40 bg-card px-3 py-2 text-xs text-muted-foreground">
          加载中…
        </div>
      ) : null}
    </div>
  );
}
