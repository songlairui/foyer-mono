import { useDraggable } from "@dnd-kit/core";
import type { Repo, RepoTag } from "./types";
import { RepoCard } from "./RepoCard";

export type RepoDragSource = "catalog" | "category";

export function toRepoDragId(source: RepoDragSource, path: string): string {
  return `${source}:${path}`;
}

interface DraggableRepoCardProps {
  source?: RepoDragSource;
  repo: Repo;
  tag?: RepoTag;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
}

export function DraggableRepoCard({ source = "catalog", repo, ...props }: DraggableRepoCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: toRepoDragId(source, repo.path),
    data: { path: repo.path, source },
  });

  return (
    <div ref={setNodeRef} className="relative">
      <RepoCard
        repo={repo}
        {...props}
        isDragging={isDragging}
        showDragHandle
        dragHandleProps={{
          ...attributes,
          ...(listeners ?? {}),
        }}
      />
    </div>
  );
}
