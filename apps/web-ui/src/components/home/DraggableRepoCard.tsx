import { useDraggable } from "@dnd-kit/core";
import type { Repo, RepoTag } from "./types";
import { RepoCard } from "./RepoCard";

interface DraggableRepoCardProps {
  id: string;
  repo: Repo;
  tag?: RepoTag;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
}

export function DraggableRepoCard({ id, ...props }: DraggableRepoCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      className="relative select-none"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      {/* 拖拽手柄层 */}
      <div
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
      <div className="relative z-20">
        <RepoCard {...props} isDragging={isDragging} showDragHandle />
      </div>
    </div>
  );
}
