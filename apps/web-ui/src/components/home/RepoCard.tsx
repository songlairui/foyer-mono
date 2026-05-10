import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Star,
  Briefcase,
  Home,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import type { Repo, RepoTag } from "./types";
import { CAT_META, relativeTime } from "./utils";
import { getClickCount, incClickCount } from "./storage";

interface RepoCardProps {
  repo: Repo;
  tag?: RepoTag;
  workDirs: string[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onTag: (path: string, tag: RepoTag | null) => void;
  onAddWorkDir: (dir: string) => void;
  isDragging?: boolean;
  dragOverlay?: boolean;
  showDragHandle?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export function RepoCard({
  repo,
  tag,
  workDirs,
  agentOnline,
  onOpen,
  onTag,
  onAddWorkDir,
  isDragging,
  dragOverlay,
  showDragHandle,
  cardRef,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(() => getClickCount(repo.path));
  // 将 /Users/xxx/ 替换成 ~/
  const pathWithTilde = repo.path.replace(/^\/Users\/[^/]+/, "~");
  const parts = pathWithTilde.split("/");
  const displayPath = parts.length > 4 ? "…/" + parts.slice(-3).join("/") : pathWithTilde;

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
      className={`flex flex-col gap-1.5 rounded-xl border bg-card px-4 pt-3 pb-2.5 transition-all hover:border-border/80 hover:bg-accent/10 ${
        isDragging && !dragOverlay ? "opacity-50" : ""
      } ${dragOverlay ? "opacity-90 cursor-grabbing shadow-2xl" : ""}`}
      style={dragOverlay ? { transform: "rotate(1deg)" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
          )}
          <span className="font-mono text-sm font-semibold leading-tight break-all min-w-0">
            {repo.repo}
          </span>
        </div>
        {tag && (
          <span
            className={`shrink-0 flex items-center gap-1 text-[10px] ${CAT_META[tag.category].color}`}
          >
            {CAT_META[tag.category].icon}
            {tag.category === "work" && tag.workDir ? tag.workDir : CAT_META[tag.category].label}
          </span>
        )}
      </div>

      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] text-muted-foreground/60 truncate font-mono">
          {displayPath}
        </span>
        {repo.lastModified ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/50">
            {relativeTime(repo.lastModified)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-border/30">
        {clicks > 0 && (
          <span className="text-[10px] text-muted-foreground/40 mr-auto">{clicks}×</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleOpen}
            disabled={loading}
          >
            <ExternalLink className="h-3 w-3" />
            打开
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">标记为</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "goal" })}>
                <Star className="h-3.5 w-3.5 mr-2" />
                Goal
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Briefcase className="h-3.5 w-3.5 mr-2" />
                  工作
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  {workDirs.map((dir) => (
                    <DropdownMenuItem
                      key={dir}
                      onClick={() => onTag(repo.path, { category: "work", workDir: dir })}
                    >
                      {dir}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      const dir = prompt("新方向名称")?.trim();
                      if (dir) {
                        onAddWorkDir(dir);
                        onTag(repo.path, { category: "work", workDir: dir });
                      }
                    }}
                  >
                    + 新建方向
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "life" })}>
                <Home className="h-3.5 w-3.5 mr-2" />
                生活
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTag(repo.path, { category: "explore" })}>
                <Compass className="h-3.5 w-3.5 mr-2" />
                探索
              </DropdownMenuItem>
              {tag && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={() => onTag(repo.path, null)}
                  >
                    移除标记
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
