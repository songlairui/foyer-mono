import { ChevronUp } from "lucide-react";
import { useChat } from "./ChatContext";

export function WaterDropTrigger() {
  const { isOpen, open } = useChat();

  if (isOpen) return null;

  return (
    <button
      onClick={open}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center w-10 h-6 rounded-t-md bg-muted/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="打开 AI 对话"
    >
      <ChevronUp className="h-4 w-4" />
    </button>
  );
}
