import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { useChat } from "./ChatContext";
import { orpc } from "#/orpc/client";
import { toast } from "sonner";

const DRAFT_KEY = "foyer.chat.draft";

export function ChatDrawer() {
  const { pageContext, isOpen, open, close } = useChat();
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(() => (isOpen ? close() : open()), [isOpen, open, close]);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const termMutation = useMutation(orpc.agent.term.mutationOptions());

  // 全局快捷键 c — 输入元素内不触发
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "c") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

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
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 输入防抖持久化到 localStorage
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, input);
      } catch {}
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    try {
      await termMutation.mutateAsync({ cmd: content });
      toast.success("已在 Ghostty 中打开");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "打开失败");
      return;
    }

    setInput("");
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
      close();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !termMutation.isPending) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center pb-2 pointer-events-none overflow-hidden"
      initial={false}
      animate={{ y: isOpen ? 0 : "calc(100% - 1.75rem)" }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
    >
      {/* trigger — panel 顶部，随内容移动 */}
      <button
        onClick={toggle}
        className="pointer-events-auto flex items-center justify-center w-40 h-7 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
        aria-label={isOpen ? "收起" : "展开"}
      >
        <ChevronUp
          className="h-5 w-5 transition-transform duration-300"
          style={{ transform: isOpen ? "rotateX(180deg)" : "rotateX(0deg)" }}
        />
      </button>

      {/* 内容区 — overflow-hidden + maxHeight 确保收起时不漏 */}
      <motion.div
        className="w-full overflow-hidden"
        animate={{ maxHeight: isOpen ? 600 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
      >
        <div className="w-full flex flex-col items-center">
          {/* 上下文信息条 */}
          <div className="pointer-events-auto mx-4 w-full max-w-[700px] px-[26px]">
            <div className="px-3 py-1.5 rounded-t-lg bg-blue-500/10 border border-b-0 border-blue-500/20">
              <p className="text-xs text-muted-foreground">
                {pageContext.title}
                <span className="text-muted-foreground/40"> · {pageContext.route}</span>
              </p>
            </div>
          </div>

          {/* 输入区域 */}
          <div className="pointer-events-auto mx-4 w-full max-w-[700px] px-4">
            <div className="flex items-end gap-2 border border-border/50 bg-muted/30 px-3 py-2 focus-within:border-blue-500/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息，Enter 发送…"
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none min-h-10"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || termMutation.isPending}
                className="shrink-0 rounded-lg p-1.5 text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="发送"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
