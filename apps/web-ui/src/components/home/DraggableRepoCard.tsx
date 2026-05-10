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
    <div ref={setNodeRef} className="relative">
      {/* 拖拽手柄层 - 覆盖整个卡片，但需要排除按钮区域 */}
      <div className="absolute inset-0 z-10" {...attributes} {...listeners} />
      <RepoCard {...props} isDragging={isDragging} showDragHandle />
    </div>
  );
}
