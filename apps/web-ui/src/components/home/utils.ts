import React from "react";
import { Star, Briefcase, Home, Compass } from "lucide-react";

export function relativeTime(ms: number): string {
  if (!ms) return "";
  const d = Date.now() - ms;
  if (d < 60000) return "刚刚";
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  if (d < 7 * 86400000) return `${Math.floor(d / 86400000)}d`;
  return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export const CAT_META = {
  goal: {
    icon: React.createElement(Star, { className: "h-3 w-3" }),
    label: "Goal",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  work: {
    icon: React.createElement(Briefcase, { className: "h-3 w-3" }),
    label: "工作",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  life: {
    icon: React.createElement(Home, { className: "h-3 w-3" }),
    label: "生活",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  explore: {
    icon: React.createElement(Compass, { className: "h-3 w-3" }),
    label: "探索",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
};

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(" ");
}
