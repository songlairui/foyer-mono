import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Badge } from "#/components/ui/badge";
import type { Category, RepoTag } from "./types";
import { CAT_META } from "./utils";
import { writeTag } from "./storage";

interface TagManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workDirs: string[];
  tags: Record<string, RepoTag>;
  onWorkDirsChange: (dirs: string[]) => void;
  onRefreshTags: () => void;
}

const CATEGORIES: Category[] = ["goal", "work", "life", "explore"];

export function TagManageDialog({
  open,
  onOpenChange,
  workDirs,
  tags,
  onWorkDirsChange,
  onRefreshTags,
}: TagManageDialogProps) {
  const [editingDir, setEditingDir] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newDir, setNewDir] = useState("");

  const categoryCounts: Record<Category, number> = { goal: 0, work: 0, life: 0, explore: 0 };
  const workDirCounts: Record<string, number> = {};

  for (const tag of Object.values(tags)) {
    categoryCounts[tag.category]++;
    if (tag.category === "work" && tag.workDir) {
      workDirCounts[tag.workDir] = (workDirCounts[tag.workDir] ?? 0) + 1;
    }
  }

  const genericWorkCount =
    categoryCounts.work - Object.values(workDirCounts).reduce((a, b) => a + b, 0);

  const startEdit = (name: string) => {
    setEditingDir(name);
    setEditValue(name);
  };

  const cancelEdit = () => {
    setEditingDir(null);
    setEditValue("");
  };

  const confirmEdit = (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      cancelEdit();
      return;
    }
    if (workDirs.includes(trimmed)) return;

    const newDirs = workDirs.map((d) => (d === oldName ? trimmed : d));
    onWorkDirsChange(newDirs);

    for (const [path, tag] of Object.entries(tags)) {
      if (tag.workDir === oldName) {
        writeTag(path, { category: "work", workDir: trimmed });
      }
    }

    onRefreshTags();
    cancelEdit();
  };

  const handleDelete = (name: string) => {
    const newDirs = workDirs.filter((d) => d !== name);
    onWorkDirsChange(newDirs);

    for (const [path, tag] of Object.entries(tags)) {
      if (tag.workDir === name) {
        writeTag(path, { category: "work" });
      }
    }

    onRefreshTags();
  };

  const handleAdd = () => {
    const trimmed = newDir.trim();
    if (!trimmed || workDirs.includes(trimmed)) return;
    onWorkDirsChange([...workDirs, trimmed]);
    setNewDir("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分类管理</DialogTitle>
          <DialogDescription>管理仓库分类标签和工作子方向</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const meta = CAT_META[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 rounded-md px-3 py-2">
                  <div className={`rounded-md p-1.5 ${meta.bg}`}>{meta.icon}</div>
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <Badge variant="outline" className="ml-auto px-1.5 text-[10px]">
                    {categoryCounts[cat]}
                  </Badge>
                </div>

                {cat === "work" && (
                  <div className="ml-9 space-y-0.5">
                    {workDirs.map((dir) => (
                      <div key={dir} className="flex items-center gap-1.5 rounded-md px-2 py-1.5">
                        {editingDir === dir ? (
                          <>
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-6 flex-1 text-xs"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmEdit(dir);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                            />
                            <Button size="icon-xs" variant="ghost" onClick={() => confirmEdit(dir)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon-xs" variant="ghost" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-muted-foreground">{dir}</span>
                            <Badge variant="secondary" className="px-1.5 text-[10px]">
                              {workDirCounts[dir] ?? 0}
                            </Badge>
                            <Button size="icon-xs" variant="ghost" onClick={() => startEdit(dir)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => handleDelete(dir)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}

                    {genericWorkCount > 0 && (
                      <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5">
                        <span className="flex-1 text-xs text-muted-foreground/50">未分子方向</span>
                        <Badge variant="secondary" className="px-1.5 text-[10px]">
                          {genericWorkCount}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Input
                        value={newDir}
                        onChange={(e) => setNewDir(e.target.value)}
                        placeholder="新子方向"
                        className="h-6 flex-1 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAdd();
                        }}
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={handleAdd}
                        disabled={!newDir.trim() || workDirs.includes(newDir.trim())}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
