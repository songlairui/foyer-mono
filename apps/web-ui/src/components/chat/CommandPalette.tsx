import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Terminal, FolderOpen, Tag, Settings, ArrowLeft, Plus } from "lucide-react";
import { useChat } from "./ChatContext";
import { orpc } from "#/orpc/client";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "#/components/ui/command";
import { readCategories, writeCategories, writeTag } from "#/components/home/storage";
import type { CategoryDef, Repo } from "#/components/home/types";
import { CATEGORY_COLORS, renderIcon } from "#/components/home/utils";

type Step = { kind: "idle" } | { kind: "repo" } | { kind: "describe"; repo: Repo };

type CategoryCandidate = {
  categoryId: string;
  subCategory?: string;
  fullLabel: string;
  score: number;
};

function scoreText(input: string, label: string): number {
  if (!input.trim()) return 0;
  const words = input
    .toLowerCase()
    .split(/[\s，,。.！!？?]+/)
    .filter((w) => w.length > 0);
  const lower = label.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (lower.includes(word)) score += word.length > 1 ? 3 : 1;
  }
  return score;
}

function buildCandidates(input: string, categories: CategoryDef[]): CategoryCandidate[] {
  const results: CategoryCandidate[] = [];
  for (const cat of categories) {
    const score = scoreText(input, cat.label);
    results.push({ categoryId: cat.id, fullLabel: cat.label, score });
    for (const sub of cat.subCategories) {
      const subScore = Math.max(score, scoreText(input, sub));
      results.push({
        categoryId: cat.id,
        subCategory: sub,
        fullLabel: `${cat.label} / ${sub}`,
        score: subScore,
      });
    }
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.fullLabel.localeCompare(b.fullLabel);
  });
  return results;
}

export function CommandPalette() {
  const { pageContext, isOpen, open, close } = useChat();
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const termMutation = useMutation(orpc.agent.term.mutationOptions());

  const { data: devicesData = [] } = useQuery({
    ...orpc.devices.list.queryOptions(),
    enabled: step.kind === "repo",
    staleTime: 5 * 60_000,
  });
  const allRepos = useMemo(() => devicesData.flatMap((d) => d.repos), [devicesData]);

  const [categories, setCategories] = useState<CategoryDef[]>([]);
  useEffect(() => {
    if (step.kind === "describe") setCategories(readCategories());
  }, [step.kind]);

  const candidates = useMemo(
    () => (step.kind === "describe" ? buildCandidates(input, categories) : []),
    [input, categories, step.kind],
  );

  // cmd+k / c 快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpenRef.current) close();
        else open();
        return;
      }
      if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.activeElement;
        const tag = el?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (el as HTMLElement)?.isContentEditable
        )
          return;
        e.preventDefault();
        if (isOpenRef.current) close();
        else open();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const reset = useCallback(() => {
    setStep({ kind: "idle" });
    setInput("");
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (isOpen) setInput("");
  }, [isOpen]);

  const runPi = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;
      try {
        await termMutation.mutateAsync({ cmd: trimmed });
        toast.success("已在 Ghostty 中打开");
        close();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "打开失败");
      }
    },
    [termMutation, close],
  );

  const handleRepoSelect = useCallback((repo: Repo) => {
    setStep({ kind: "describe", repo });
    setInput("");
  }, []);

  const handleCategorySelect = useCallback(
    (c: CategoryCandidate, repo: Repo) => {
      writeTag(repo.path, { categoryId: c.categoryId, subCategory: c.subCategory });
      toast.success(`已归类到 "${c.fullLabel}"`);
      close();
    },
    [close],
  );

  const handleCreateCategory = useCallback(
    (repo: Repo) => {
      const label = input.trim();
      if (!label) return;
      const existing = readCategories();
      const color = CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length]!;
      const newCat: CategoryDef = {
        id: `cat_${Date.now()}`,
        label,
        icon: "Tag",
        color: color.color,
        bg: color.bg,
        subCategories: [],
      };
      writeCategories([...existing, newCat]);
      writeTag(repo.path, { categoryId: newCat.id });
      toast.success(`已新建分类 "${label}" 并归类`);
      close();
    },
    [input, close],
  );

  const goBack = useCallback(() => {
    if (step.kind === "describe") setStep({ kind: "repo" });
    else setStep({ kind: "idle" });
    setInput("");
  }, [step.kind]);

  const piText = step.kind === "idle" ? input.trim() : "";
  const isDescribeStep = step.kind === "describe";
  const canCreate = isDescribeStep && input.trim().length > 0;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => (open ? void 0 : close())}
      shouldFilter={!isDescribeStep}
    >
      {/* 步骤面包屑 */}
      {step.kind !== "idle" && (
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            返回
          </button>
          {step.kind === "describe" && (
            <>
              <span className="text-xs text-muted-foreground/40">/</span>
              <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                {step.repo.repo}
              </span>
            </>
          )}
        </div>
      )}

      <CommandInput
        placeholder={
          step.kind === "repo"
            ? "搜索项目…"
            : step.kind === "describe"
              ? "描述分类意向，比如场景、打算…"
              : "输入命令或直接描述任务…"
        }
        value={input}
        onValueChange={setInput}
        onKeyDown={(e) => {
          if (e.key === "Escape" && step.kind !== "idle") {
            e.preventDefault();
            e.stopPropagation();
            goBack();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && step.kind === "idle" && piText) {
            const val = (e.target as HTMLInputElement).value.trim();
            if (val) {
              e.preventDefault();
              e.stopPropagation();
              void runPi(val);
            }
          }
        }}
      />

      <CommandList>
        {/* ── idle ── */}
        {step.kind === "idle" && (
          <>
            <CommandEmpty>无匹配结果，按 Enter 在终端执行</CommandEmpty>

            {piText && (
              <CommandGroup heading="终端执行" forceMount>
                <CommandItem onSelect={() => void runPi(piText)} value={piText}>
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    pi <span className="text-foreground">{piText}</span>
                  </span>
                  <CommandShortcut>⏎</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="项目">
              <CommandItem onSelect={() => toast.info("即将支持")}>
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span>聊聊当前项目…</span>
                <CommandShortcut>⇧⏎</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => toast.info("即将支持")}>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span>打开项目…</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="应用">
              <CommandItem
                onSelect={() => {
                  setStep({ kind: "repo" });
                  setInput("");
                }}
              >
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span>添加分类…</span>
              </CommandItem>
              <CommandItem onSelect={() => toast.info("即将支持")}>
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>设置…</span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="上下文">
              <CommandItem disabled>
                <span className="text-xs text-muted-foreground">
                  {pageContext.title} · {pageContext.route}
                </span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* ── 选择项目 ── */}
        {step.kind === "repo" && (
          <>
            <CommandEmpty>未找到项目</CommandEmpty>
            <CommandGroup heading="选择项目">
              {allRepos.map((repo) => (
                <CommandItem
                  key={repo.path}
                  value={`${repo.repo} ${repo.path}`}
                  onSelect={() => handleRepoSelect(repo)}
                >
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{repo.repo}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {repo.path.replace(/^\/Users\/[^/]+/, "~")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* ── 描述意向，选分类 ── */}
        {step.kind === "describe" && (
          <>
            <CommandEmpty>暂无分类，在上方输入新分类名称后按 Enter</CommandEmpty>

            <CommandGroup heading="选择分类">
              {candidates.map((c) => {
                const cat = categories.find((cat) => cat.id === c.categoryId);
                return (
                  <CommandItem
                    key={`${c.categoryId}:${c.subCategory ?? ""}`}
                    value={`${c.fullLabel}__${c.categoryId}`}
                    onSelect={() => handleCategorySelect(c, step.repo)}
                  >
                    {cat && (
                      <span className={`flex items-center justify-center ${cat.color}`}>
                        {renderIcon(cat.icon, "h-4 w-4")}
                      </span>
                    )}
                    <span className="flex-1">{c.fullLabel}</span>
                    {c.score > 0 && <span className="text-xs text-emerald-400/60">匹配</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {canCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create_new__"
                    onSelect={() => handleCreateCategory(step.repo)}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span>
                      新建分类 <span className="font-medium text-foreground">"{input.trim()}"</span>
                    </span>
                    <CommandShortcut>⏎</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
