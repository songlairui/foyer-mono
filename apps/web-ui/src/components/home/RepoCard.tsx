import { useState, type HTMLAttributes } from "react";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Repo } from "./types";
import { cn, relativeTime } from "./utils";
import { getClickCount, incClickCount } from "./storage";

interface RepoCardProps {
  repo: Repo;
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  isDragging?: boolean;
  dragOverlay?: boolean;
  showDragHandle?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export function RepoCard({
  repo,
  agentOnline,
  onOpen,
  isDragging,
  dragOverlay,
  showDragHandle,
  dragHandleProps,
  cardRef,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(() => getClickCount(repo.path));

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
      ref={cardRef}
      data-repo-path={repo.path}
      className={`group relative flex flex-col gap-1.5 rounded-xl border bg-card px-4 pt-3 pb-2.5 transition-all hover:border-border/80 hover:bg-accent/10 ${
        isDragging && !dragOverlay ? "opacity-50" : ""
      } ${dragOverlay ? "opacity-90 cursor-grabbing shadow-2xl" : ""}`}
      style={dragOverlay ? { transform: "rotate(1deg)" } : undefined}
    >
      {/* 打开按钮 - 右上角 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-1.5 top-1.5 h-6 w-6 p-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-opacity"
            onClick={handleOpen}
            disabled={loading}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>打开</TooltipContent>
      </Tooltip>

      <div className="flex items-start gap-2 min-w-0">
        {showDragHandle && (
          <div
            {...dragHandleProps}
            aria-label={dragHandleProps?.["aria-label"] ?? "拖拽 repo"}
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center -ml-1 mt-0.5 rounded text-muted-foreground/45 cursor-grab touch-none select-none transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing",
              dragHandleProps?.className,
            )}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <span className="font-mono text-sm font-semibold leading-tight break-all min-w-0">
          {repo.repo}
        </span>
      </div>

      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        {repo.lastModified ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/50">
            {relativeTime(repo.lastModified)}
          </span>
        ) : null}
        {clicks > 0 && <span className="text-[10px] text-muted-foreground/40">{clicks}×</span>}
      </div>
    </div>
  );
}
