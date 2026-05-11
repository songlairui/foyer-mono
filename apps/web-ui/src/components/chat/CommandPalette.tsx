import { useEffect, useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Terminal, FolderOpen, Tag, Settings } from "lucide-react";
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
} from "#/components/ui/command";

export function CommandPalette() {
  const { pageContext, isOpen, open, close } = useChat();
  const [input, setInput] = useState("");
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const termMutation = useMutation(orpc.agent.term.mutationOptions());

  // cmd+k / c 打开面板
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

  // 打开时清空输入
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

  const piText = input.trim();

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => (open ? void 0 : close())}>
      <CommandInput
        placeholder="输入命令或直接描述任务…"
        value={input}
        onValueChange={setInput}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && piText) {
            e.preventDefault();
            void runPi(piText);
          }
        }}
      />

      <CommandList>
        <CommandEmpty>无匹配结果，按 Enter 在终端执行</CommandEmpty>

        {piText && (
          <CommandGroup heading="终端执行">
            <CommandItem onSelect={() => void runPi(piText)}>
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                pi <span className="text-foreground">{piText}</span>
              </span>
              <CommandShortcut>⏎</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="项目">
          <CommandItem
            onSelect={() => {
              /* TODO: LLM 对话 */ toast.info("即将支持");
            }}
          >
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span>聊聊当前项目…</span>
            <CommandShortcut>⇧⏎</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              /* TODO */ toast.info("即将支持");
            }}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span>打开项目…</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="应用">
          <CommandItem
            onSelect={() => {
              /* TODO: 跳转 organize */
            }}
          >
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span>添加分类…</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              /* TODO */ toast.info("即将支持");
            }}
          >
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
      </CommandList>
    </CommandDialog>
  );
}
