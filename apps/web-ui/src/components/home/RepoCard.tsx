import { useState, type HTMLAttributes, useCallback, useRef } from "react";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { ExternalLink, GitBranch, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Repo } from "./types";
import { cn, relativeTime } from "./utils";
import { getClickCount, incClickCount } from "./storage";
import { RepoDetailModal } from "./RepoDetailModal";

interface RepoCardProps {
  repo: Repo;
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  compact?: boolean;
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
  compact = false,
  isDragging,
  dragOverlay,
  showDragHandle,
  dragHandleProps,
  cardRef,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(() => getClickCount(repo.path));
  const [detailOpen, setDetailOpen] = useState(false);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const cardElRef = useRef<HTMLDivElement | null>(null);

  const worktrees = repo.worktrees ?? [];
  const hasWorktrees = worktrees.length > 1;
  const activeWorktrees = worktrees.filter((w) => !w.bare);

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

  const handleOpenPath = useCallback(
    async (path: string) => {
      if (!agentOnline) {
        toast.error("agent 未启动 · foyer agent start");
        return;
      }
      try {
        await onOpen(path);
        setClicks(incClickCount(repo.path));
      } catch {
        // error handled by parent
      }
    },
    [agentOnline, onOpen, repo.path],
  );

  const handleCardClick = useCallback(() => {
    if (!isDragging && !dragOverlay) {
      const rect = cardElRef.current?.getBoundingClientRect();
      if (rect) {
        setSourceRect(rect);
        setDetailOpen(true);
      }
    }
  }, [isDragging, dragOverlay]);

  return (
    <>
      <div
        ref={(el) => {
          cardElRef.current = el;
          if (cardRef) cardRef(el);
        }}
        data-repo-path={repo.path}
        onClick={handleCardClick}
        className={`group flex flex-col gap-1 rounded-xl border bg-card transition-all hover:border-border/80 hover:bg-accent/10 cursor-pointer ${compact ? "px-3 py-1.5" : "px-4 pt-3 pb-2.5"} ${
          isDragging && !dragOverlay ? "opacity-50" : ""
        } ${dragOverlay ? "opacity-90 cursor-grabbing shadow-2xl" : ""}`}
        style={dragOverlay ? { transform: "rotate(1deg)" } : undefined}
      >
        {/* 标题行：拖拽手柄 + 项目名 + worktree 图标 + 打开按钮 */}
        <div className="flex items-center gap-2 min-w-0">
          {showDragHandle && (
            <div
              {...dragHandleProps}
              aria-label={dragHandleProps?.["aria-label"] ?? "拖拽 repo"}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center -ml-1 rounded text-muted-foreground/45 cursor-grab touch-none select-none transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing",
                dragHandleProps?.className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate font-mono text-sm font-semibold leading-tight min-w-0 cursor-default">
                {repo.repo}
              </span>
            </TooltipTrigger>
            <TooltipContent>{repo.repo}</TooltipContent>
          </Tooltip>

          {hasWorktrees && (
            <WorktreeDropdown
              worktrees={activeWorktrees}
              mainPath={repo.path}
              agentOnline={agentOnline}
              onOpenPath={handleOpenPath}
            />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 w-6 shrink-0 p-0 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                onClick={handleOpen}
                disabled={loading}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>打开</TooltipContent>
          </Tooltip>
        </div>

        {!compact && repo.description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground truncate cursor-default">
                {repo.description}
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{repo.description}</TooltipContent>
          </Tooltip>
        )}

        {!compact && (
          <div className="flex items-center justify-between gap-2 min-w-0">
            {repo.lastModified ? (
              <span className="shrink-0 text-[11px] text-muted-foreground/50">
                {relativeTime(repo.lastModified)}
              </span>
            ) : null}
            {clicks > 0 && <span className="text-[10px] text-muted-foreground/40">{clicks}×</span>}
          </div>
        )}
      </div>

      {detailOpen && sourceRect && (
        <RepoDetailModal
          repo={repo}
          sourceRect={sourceRect}
          agentOnline={agentOnline}
          onOpen={handleOpenPath}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

function WorktreeDropdown({
  worktrees,
  mainPath,
  agentOnline,
  onOpenPath,
}: {
  worktrees: Array<{ path: string; branch: string }>;
  mainPath: string;
  agentOnline: boolean;
  onOpenPath: (path: string) => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              <GitBranch className="h-3 w-3" />
              {worktrees.length}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Worktree</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        {worktrees.map((wt) => (
          <DropdownMenuItem
            key={wt.path}
            onClick={(e) => {
              e.stopPropagation();
              void onOpenPath(wt.path);
            }}
            disabled={!agentOnline}
            className="flex items-center gap-2 text-xs py-1.5"
          >
            <GitBranch
              className={`h-3 w-3 shrink-0 ${wt.path === mainPath ? "text-foreground" : "text-amber-400"}`}
            />
            <span className={`font-mono truncate ${wt.path === mainPath ? "font-semibold" : ""}`}>
              {wt.branch || "(detached)"}
            </span>
            {wt.path === mainPath && (
              <span className="text-[9px] text-muted-foreground ml-auto shrink-0">main</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
