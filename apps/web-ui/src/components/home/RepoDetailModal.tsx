import { useCallback, useState } from "react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { FlyingFlipCard, type FlyingFlipCardPhase } from "#/components/ui/flying-flip-card";
import { ArrowLeft, ExternalLink, GitBranch, X } from "lucide-react";
import type { Repo, Worktree } from "./types";
import { cn, relativeTime } from "./utils";

interface RepoDetailModalProps {
  repo: Repo;
  sourceRect: DOMRect;
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  onClose: () => void;
}

export function RepoDetailModal({
  repo,
  sourceRect,
  agentOnline,
  onOpen,
  onClose,
}: RepoDetailModalProps) {
  const [flipped, setFlipped] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const worktrees = repo.worktrees ?? [];
  const hasWorktrees = worktrees.length > 1;
  const activeWorktrees = worktrees.filter((w) => !w.bare);

  const handleOpen = useCallback(
    async (path: string) => {
      setOpeningPath(path);
      try {
        await onOpen(path);
      } finally {
        setOpeningPath(null);
      }
    },
    [onOpen],
  );

  return (
    <FlyingFlipCard
      sourceRect={sourceRect}
      flipped={flipped}
      animateStyle="reference"
      onFlippedChange={setFlipped}
      onClose={onClose}
      overlay={({ phase, requestClose }) => (
        <button
          onClick={(event) => {
            event.stopPropagation();
            requestClose();
          }}
          aria-label="关闭详情"
          className={cn(
            "absolute right-6 top-6 z-[60] flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur transition-all duration-300",
            phase === "arrived" ? "opacity-100" : "opacity-0",
            "cursor-pointer hover:bg-white/20 hover:text-white",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      front={({ phase }) => (
        <FrontFace
          repo={repo}
          hasWorktrees={hasWorktrees}
          activeWorktrees={activeWorktrees}
          agentOnline={agentOnline}
          openingPath={openingPath}
          phase={phase}
          onOpen={handleOpen}
          onFlip={() => phase === "arrived" && setFlipped(true)}
        />
      )}
      back={() => (
        <BackFace
          repo={repo}
          activeWorktrees={activeWorktrees}
          agentOnline={agentOnline}
          openingPath={openingPath}
          onOpen={handleOpen}
          onFlipBack={() => setFlipped(false)}
        />
      )}
    />
  );
}

function FrontFace({
  repo,
  hasWorktrees,
  activeWorktrees,
  agentOnline,
  openingPath,
  phase,
  onOpen,
  onFlip,
}: {
  repo: Repo;
  hasWorktrees: boolean;
  activeWorktrees: Worktree[];
  agentOnline: boolean;
  openingPath: string | null;
  phase: FlyingFlipCardPhase;
  onOpen: (path: string) => Promise<void>;
  onFlip: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-white/15 bg-card/95 p-6 shadow-2xl">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-mono text-lg font-bold truncate">{repo.repo}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono break-all">
            {repo.path}
          </p>
        </div>
        {hasWorktrees && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFlip();
                }}
                disabled={phase !== "arrived"}
                className="flex items-center gap-1 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <GitBranch className="h-3 w-3" />
                {activeWorktrees.length}
              </button>
            </TooltipTrigger>
            <TooltipContent>点击查看 worktree</TooltipContent>
          </Tooltip>
        )}
      </div>

      {repo.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{repo.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-auto">
        {repo.lane && (
          <Badge variant="outline" className="text-[10px]">
            {repo.lane}
          </Badge>
        )}
        {repo.slug && (
          <Badge variant="outline" className="text-[10px]">
            {repo.slug}
          </Badge>
        )}
        {repo.lastModified && (
          <span className="text-[11px] text-muted-foreground/50 ml-auto self-center">
            {relativeTime(repo.lastModified)}
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          variant="default"
          className="flex-1 gap-1.5 text-xs h-8"
          disabled={!agentOnline || openingPath === repo.path}
          onClick={(e) => {
            e.stopPropagation();
            void onOpen(repo.path);
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {openingPath === repo.path ? "打开中…" : agentOnline ? "打开" : "agent 未启动"}
        </Button>
        {hasWorktrees && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={onFlip}>
            <GitBranch className="h-3.5 w-3.5" />
            Worktree
          </Button>
        )}
      </div>
    </div>
  );
}

function BackFace({
  repo,
  activeWorktrees,
  agentOnline,
  openingPath,
  onOpen,
  onFlipBack,
}: {
  repo: Repo;
  activeWorktrees: Worktree[];
  agentOnline: boolean;
  openingPath: string | null;
  onOpen: (path: string) => Promise<void>;
  onFlipBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-amber-500/20 bg-card/95 p-6 shadow-2xl">
      <div className="flex items-center gap-2">
        <button
          onClick={onFlipBack}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <GitBranch className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold">Worktree</span>
        <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">
          {activeWorktrees.length}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto min-h-0">
        {activeWorktrees.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/40">
            没有活跃的 worktree
          </div>
        ) : (
          activeWorktrees.map((wt) => (
            <WorktreeRow
              key={wt.path}
              worktree={wt}
              isMain={wt.path === repo.path}
              agentOnline={agentOnline}
              onOpen={onOpen}
              opening={openingPath === wt.path}
            />
          ))
        )}
      </div>

      <div className="text-[10px] text-muted-foreground/40 text-center">
        点击 worktree 在编辑器中打开
      </div>
    </div>
  );
}

function WorktreeRow({
  worktree,
  isMain,
  agentOnline,
  onOpen,
  opening,
}: {
  worktree: Worktree;
  isMain: boolean;
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  opening: boolean;
}) {
  return (
    <button
      onClick={() => onOpen(worktree.path)}
      disabled={!agentOnline || opening}
      className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 transition-colors hover:bg-accent/30 disabled:opacity-50 text-left w-full cursor-pointer"
    >
      <GitBranch
        className={cn("h-3.5 w-3.5 shrink-0", isMain ? "text-foreground" : "text-amber-400")}
      />
      <span className={cn("text-xs font-mono truncate", isMain && "font-semibold")}>
        {worktree.branch || "(detached)"}
      </span>
      {isMain && (
        <Badge variant="outline" className="text-[9px] px-1 shrink-0">
          main
        </Badge>
      )}
      <span className="ml-auto shrink-0">
        <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
      </span>
    </button>
  );
}
