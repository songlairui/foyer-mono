import { ScrollArea } from "#/components/ui/scroll-area";
import { Badge } from "#/components/ui/badge";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Repo, RepoTag, Category } from "./types";
import { SortableRepoCard } from "./SortableRepoCard";
import { CAT_META } from "./utils";

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
  id?: string;
}

export function CategoryPane({
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
  id,
}: CategoryPaneProps) {
  const meta = CAT_META[category];
  const label = workDir ?? meta.label;
  const ids = repos.map((r) => r.path);
  const { setNodeRef, isOver: isCurrentlyOver } = useDroppable({ id: id || "" });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-0 border rounded-xl p-4 transition-all flex-1 ${
        isOver || isCurrentlyOver ? "border-ring/50 bg-ring/5" : "border-border/30 bg-card/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className={`p-1.5 rounded-md ${meta.bg}`}>{meta.icon}</div>
        <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
          {label}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">
          {repos.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0">
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
