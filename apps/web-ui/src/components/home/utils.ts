import React from "react";
import {
  Star,
  Briefcase,
  Home,
  Compass,
  Heart,
  Book,
  Code,
  Music,
  Camera,
  Coffee,
  Gamepad2,
  Globe,
  Lightbulb,
  Pen,
  Rocket,
  ShoppingBag,
  Trophy,
  Users,
  Zap,
  Cloud,
  Database,
  FileText,
  Flame,
  Gift,
  Key,
  Map,
  Palette,
  Puzzle,
  Shield,
  Target,
  Wand2,
  Wrench,
  Terminal,
  Package,
  Bell,
  Calendar,
  Clock,
  Eye,
  Feather,
  Filter,
  Flag,
  Hash,
  Image,
  Link,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Moon,
  Paperclip,
  Phone,
  Pin,
  Power,
  Printer,
  Radio,
  Save,
  Scissors,
  Share2,
  Sliders,
  Smile,
  Sun,
  Tablet,
  Tag,
  ThumbsUp,
  Truck,
  Umbrella,
  User,
  Video,
  Volume2,
  Watch,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { CategoryDef } from "./types";

export function relativeTime(ms: number): string {
  if (!ms) return "";
  const d = Date.now() - ms;
  if (d < 60000) return "刚刚";
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  if (d < 7 * 86400000) return `${Math.floor(d / 86400000)}d`;
  return new Date(ms).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export const ICON_MAP: Record<string, LucideIcon> = {
  Star,
  Briefcase,
  Home,
  Compass,
  Heart,
  Book,
  Code,
  Music,
  Camera,
  Coffee,
  Gamepad2,
  Globe,
  Lightbulb,
  Pen,
  Rocket,
  ShoppingBag,
  Trophy,
  Users,
  Zap,
  Cloud,
  Database,
  FileText,
  Flame,
  Gift,
  Key,
  Map,
  Palette,
  Puzzle,
  Shield,
  Target,
  Wand2,
  Wrench,
  Terminal,
  Package,
  Bell,
  Calendar,
  Clock,
  Eye,
  Feather,
  Filter,
  Flag,
  Hash,
  Image,
  Link,
  Lock,
  Mail,
  MessageCircle,
  Mic,
  Moon,
  Paperclip,
  Phone,
  Pin,
  Power,
  Printer,
  Radio,
  Save,
  Scissors,
  Share2,
  Sliders,
  Smile,
  Sun,
  Tablet,
  Tag,
  ThumbsUp,
  Truck,
  Umbrella,
  User,
  Video,
  Volume2,
  Watch,
  AlertCircle,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export const CATEGORY_COLORS = [
  { color: "text-amber-400", bg: "bg-amber-500/10", label: "琥珀" },
  { color: "text-blue-400", bg: "bg-blue-500/10", label: "蓝" },
  { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "翠绿" },
  { color: "text-purple-400", bg: "bg-purple-500/10", label: "紫" },
  { color: "text-rose-400", bg: "bg-rose-500/10", label: "玫红" },
  { color: "text-cyan-400", bg: "bg-cyan-500/10", label: "青" },
  { color: "text-orange-400", bg: "bg-orange-500/10", label: "橙" },
  { color: "text-violet-400", bg: "bg-violet-500/10", label: "紫罗兰" },
];

export function renderIcon(name: string, className: string) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return React.createElement(HelpCircle, { className });
  return React.createElement(IconComponent, { className });
}

export function getCatMeta(category: CategoryDef) {
  return {
    icon: renderIcon(category.icon, "h-3 w-3"),
    label: category.label,
    color: category.color,
    bg: category.bg,
  };
}

function HelpCircle(props: { className?: string }) {
  const Icon = ICON_MAP.AlertCircle;
  return React.createElement(Icon, props);
}

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(" ");
}
