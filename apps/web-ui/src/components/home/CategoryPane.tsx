import { ScrollArea } from "#/components/ui/scroll-area";
import { Badge } from "#/components/ui/badge";
import type { Repo, Category } from "./types";
import { RepoCard } from "./RepoCard";
import { CAT_META } from "./utils";

interface CategoryPaneProps {
  category: Category;
  workDir?: string;
  repos: Repo[];
  agentOnline: boolean;
  onOpen: (path: string) => Promise<void>;
  id?: string;
}

export function CategoryPane({
  category,
  workDir,
  repos,
  agentOnline,
  onOpen,
  id,
}: CategoryPaneProps) {
  const meta = CAT_META[category];
  const label = workDir ?? meta.label;

  return (
    <div
      id={id}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/30 bg-card/30 p-4 transition-all"
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

      <ScrollArea className="min-h-0 flex-1">
        {repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-1 text-muted-foreground/40 text-xs">
            <p>拖入项目</p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 pr-2">
            {repos.map((repo) => (
              <RepoCard key={repo.path} repo={repo} agentOnline={agentOnline} onOpen={onOpen} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
