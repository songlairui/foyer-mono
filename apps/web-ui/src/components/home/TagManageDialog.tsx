import { useMemo, useState } from "react";
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
import { Switch } from "#/components/ui/switch";
import type { CategoryDef, RepoTag } from "./types";
import { ICON_OPTIONS, CATEGORY_COLORS, renderIcon } from "./utils";
import { writeTag } from "./storage";

interface TagManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryDef[];
  hiddenSubs: Record<string, Set<string>>;
  tags: Record<string, RepoTag>;
  onCategoriesChange: (cats: CategoryDef[]) => void;
  onHiddenSubsChange: (hidden: Record<string, Set<string>>) => void;
  onRefreshTags: () => void;
}

let _catCounter = 0;

export function TagManageDialog({
  open,
  onOpenChange,
  categories,
  hiddenSubs,
  tags,
  onCategoriesChange,
  onHiddenSubsChange,
  onRefreshTags,
}: TagManageDialogProps) {
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColorIdx, setEditColorIdx] = useState(0);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editSubValue, setEditSubValue] = useState("");
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({});
  const [newCatLabel, setNewCatLabel] = useState("");

  const { catCounts, subCounts } = useMemo(() => {
    const catCounts: Record<string, number> = {};
    const subCounts: Record<string, Record<string, number>> = {};

    for (const tag of Object.values(tags)) {
      catCounts[tag.categoryId] = (catCounts[tag.categoryId] ?? 0) + 1;
      if (tag.subCategory) {
        const subs = (subCounts[tag.categoryId] ??= {});
        subs[tag.subCategory] = (subs[tag.subCategory] ?? 0) + 1;
      }
    }

    return { catCounts, subCounts };
  }, [tags]);

  const genericCount = (catId: string) => {
    const total = catCounts[catId] ?? 0;
    const subs = subCounts[catId];
    const subTotal = subs ? Object.values(subs).reduce((a, b) => a + b, 0) : 0;
    return total - subTotal;
  };

  // --- Category handlers ---

  const startEditCat = (cat: CategoryDef) => {
    setEditingCat(cat.id);
    setEditLabel(cat.label);
    setEditIcon(cat.icon);
    const idx = CATEGORY_COLORS.findIndex((c) => c.color === cat.color && c.bg === cat.bg);
    setEditColorIdx(idx >= 0 ? idx : 0);
  };

  const cancelEditCat = () => setEditingCat(null);

  const confirmEditCat = (catId: string) => {
    const trimmed = editLabel.trim();
    if (!trimmed) return;
    const colors = CATEGORY_COLORS[editColorIdx] ?? CATEGORY_COLORS[0];
    const newCats = categories.map((c) =>
      c.id === catId
        ? { ...c, label: trimmed, icon: editIcon || c.icon, color: colors.color, bg: colors.bg }
        : c,
    );
    onCategoriesChange(newCats);
    setEditingCat(null);
  };

  const handleDeleteCat = (catId: string) => {
    onCategoriesChange(categories.filter((c) => c.id !== catId));
    const nextHidden = { ...hiddenSubs };
    delete nextHidden[catId];
    onHiddenSubsChange(nextHidden);
    for (const [path, tag] of Object.entries(tags)) {
      if (tag.categoryId === catId) writeTag(path, null);
    }
    onRefreshTags();
  };

  const handleAddCat = () => {
    const trimmed = newCatLabel.trim();
    if (!trimmed) return;
    const colors = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    _catCounter++;
    onCategoriesChange([
      ...categories,
      {
        id: `cat_${Date.now()}_${_catCounter}`,
        label: trimmed,
        icon: "Star",
        color: colors.color,
        bg: colors.bg,
        subCategories: [],
      },
    ]);
    setNewCatLabel("");
  };

  // --- Sub-category handlers ---

  const handleToggleSub = (catId: string, sub: string) => {
    const next = { ...hiddenSubs };
    const set = next[catId] ? new Set(next[catId]) : new Set<string>();
    if (set.has(sub)) set.delete(sub);
    else set.add(sub);
    next[catId] = set;
    onHiddenSubsChange(next);
  };

  const handleAddSub = (catId: string) => {
    const val = (newSubInputs[catId] ?? "").trim();
    if (!val) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat || cat.subCategories.includes(val)) return;
    onCategoriesChange(
      categories.map((c) =>
        c.id === catId ? { ...c, subCategories: [...c.subCategories, val] } : c,
      ),
    );
    setNewSubInputs((prev) => ({ ...prev, [catId]: "" }));
  };

  const startEditSub = (sub: string) => {
    setEditingSub(sub);
    setEditSubValue(sub);
  };

  const cancelEditSub = () => {
    setEditingSub(null);
    setEditSubValue("");
  };

  const confirmEditSub = (catId: string, oldName: string) => {
    const trimmed = editSubValue.trim();
    if (!trimmed || trimmed === oldName) {
      cancelEditSub();
      return;
    }
    const cat = categories.find((c) => c.id === catId);
    if (!cat || cat.subCategories.includes(trimmed)) return;

    onCategoriesChange(
      categories.map((c) => {
        if (c.id !== catId) return c;
        return { ...c, subCategories: c.subCategories.map((s) => (s === oldName ? trimmed : s)) };
      }),
    );

    for (const [path, tag] of Object.entries(tags)) {
      if (tag.categoryId === catId && tag.subCategory === oldName) {
        writeTag(path, { categoryId: catId, subCategory: trimmed });
      }
    }
    onRefreshTags();
    cancelEditSub();
  };

  const handleDeleteSub = (catId: string, name: string) => {
    onCategoriesChange(
      categories.map((c) => {
        if (c.id !== catId) return c;
        return { ...c, subCategories: c.subCategories.filter((s) => s !== name) };
      }),
    );

    for (const [path, tag] of Object.entries(tags)) {
      if (tag.categoryId === catId && tag.subCategory === name) {
        writeTag(path, { categoryId: catId });
      }
    }
    onRefreshTags();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[70vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>分类管理</DialogTitle>
          <DialogDescription>管理分类、子分类和图标</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {categories.map((cat) => {
            const isEditing = editingCat === cat.id;
            const hidden = hiddenSubs[cat.id];

            return (
              <div
                key={cat.id}
                className="rounded-lg border border-border/30 bg-card/40 overflow-hidden"
              >
                {/* Category header */}
                {isEditing ? (
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1.5">图标</div>
                      <div className="grid grid-cols-12 gap-1 max-h-32 overflow-y-auto">
                        {ICON_OPTIONS.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setEditIcon(name)}
                            className={`p-1.5 rounded-md transition-colors ${
                              editIcon === name
                                ? "bg-primary/20 ring-1 ring-primary/50"
                                : "hover:bg-accent/40"
                            }`}
                          >
                            {renderIcon(name, "h-3.5 w-3.5")}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="分类名称"
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEditCat(cat.id);
                      }}
                      autoFocus
                    />

                    <div className="flex items-center gap-1.5">
                      {CATEGORY_COLORS.map((c, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditColorIdx(idx)}
                          className={`w-5 h-5 rounded-full ${c.bg} border-2 transition-all ${
                            editColorIdx === idx ? "border-white scale-110" : "border-transparent"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => confirmEditCat(cat.id)}
                        disabled={!editLabel.trim()}
                      >
                        <Check className="h-3 w-3" /> 确认
                      </Button>
                      <Button size="xs" variant="ghost" onClick={cancelEditCat}>
                        <X className="h-3 w-3" /> 取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className={`rounded-md p-1.5 ${cat.bg}`}>
                      {renderIcon(cat.icon, "h-3 w-3")}
                    </div>
                    <span className={`text-xs font-semibold ${cat.color}`}>{cat.label}</span>
                    <Badge variant="outline" className="ml-auto px-1.5 text-[10px]">
                      {catCounts[cat.id] ?? 0}
                    </Badge>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => startEditCat(cat)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => handleDeleteCat(cat.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Sub-categories */}
                <div className="border-t border-border/20 px-3 py-1.5 space-y-0.5">
                  {cat.subCategories.map((sub) => (
                    <div key={sub} className="flex items-center gap-1.5 py-0.5 group">
                      {editingSub === sub ? (
                        <>
                          <Input
                            value={editSubValue}
                            onChange={(e) => setEditSubValue(e.target.value)}
                            className="h-6 flex-1 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmEditSub(cat.id, sub);
                              if (e.key === "Escape") cancelEditSub();
                            }}
                            autoFocus
                          />
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => confirmEditSub(cat.id, sub)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon-xs" variant="ghost" onClick={cancelEditSub}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Switch
                            label={sub}
                            checked={!hidden?.has(sub)}
                            onToggle={() => handleToggleSub(cat.id, sub)}
                            className="min-w-0 flex-1"
                          />
                          <Badge variant="secondary" className="px-1.5 text-[10px] shrink-0">
                            {subCounts[cat.id]?.[sub] ?? 0}
                          </Badge>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEditSub(sub)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteSub(cat.id, sub)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}

                  {genericCount(cat.id) > 0 && (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <span className="flex-1 text-xs text-muted-foreground/50">未分子分类</span>
                      <Badge variant="secondary" className="px-1.5 text-[10px]">
                        {genericCount(cat.id)}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 py-0.5">
                    <Input
                      value={newSubInputs[cat.id] ?? ""}
                      onChange={(e) =>
                        setNewSubInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      placeholder="新子分类"
                      className="h-6 flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSub(cat.id);
                      }}
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleAddSub(cat.id)}
                      disabled={
                        !(newSubInputs[cat.id] ?? "").trim() ||
                        cat.subCategories.includes((newSubInputs[cat.id] ?? "").trim())
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add category */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 p-2 lg:col-span-2">
            <Input
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              placeholder="新分类"
              className="h-7 flex-1 text-xs border-0 bg-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCat();
              }}
            />
            <Button size="xs" variant="ghost" onClick={handleAddCat} disabled={!newCatLabel.trim()}>
              <Plus className="h-3 w-3" /> 添加
            </Button>
          </div>
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
