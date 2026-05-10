import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { Repo, RepoTag } from "./types";
import { RepoCard } from "./RepoCard";

interface SortableRepoCardProps {
  id: string;
  repo: Repo;
  tag?: RepoTag;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
}

export function SortableRepoCard({ id, ...props }: SortableRepoCardProps) {
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
      {/* 只拖拽区域 - 整个卡片，但是不覆盖按钮区域 */}
      <div
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
    </div>
  );
}
