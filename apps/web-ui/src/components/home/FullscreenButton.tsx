import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Maximize, Minimize } from "lucide-react";

export function FullscreenButton() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    // 确保只在客户端执行
    if (typeof document === "undefined") return;

    const cb = () => setFull(!!document.fullscreenElement);
    cb(); // 初始化状态
    document.addEventListener("fullscreenchange", cb);
    return () => document.removeEventListener("fullscreenchange", cb);
  }, []);

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (typeof document === "undefined") return;
        if (full) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen();
        }
      }}
      title={full ? "退出全屏" : "全屏"}
    >
      {full ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
    </Button>
  );
}
