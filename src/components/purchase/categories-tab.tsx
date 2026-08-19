import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import {
  listPurchaseCategories,
  upsertPurchaseCategory,
  deletePurchaseCategory,
} from "@/lib/api/purchase.functions";
import { listAccounts } from "@/lib/api/accounting.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { toast } from "sonner";

/* ============================== Categories Tab ============================== */

export function CategoriesTab() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listFn = useServerFn(listPurchaseCategories);
  const upsertFn = useServerFn(upsertPurchaseCategory);
  const deleteFn = useServerFn(deletePurchaseCategory);
  const listAccFn = useServerFn(listAccounts);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchase_categories", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_categories", companyId],
    queryFn: () => listAccFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const postableAccounts = (accounts as any[]).filter((a) => !a.is_group);

  const tree = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rows as any[]) {
      const key = r.parent_id ?? "__root__";
      (map[key] ??= []).push(r);
    }
    return map;
  }, [rows]);
  const roots = tree["__root__"] ?? [];

  // A category can't become its own parent, nor the parent of one of its
  // own descendants (that would create a cycle in the tree).
  const getDescendantIds = (id: string): Set<string> => {
    const out = new Set<string>();
    const walk = (nodeId: string) => {
      for (const child of tree[nodeId] ?? []) {
        out.add(child.id);
        walk(child.id);
      }
    };
    walk(id);
    return out;
  };

  const empty = {
    id: undefined as string | undefined, parent_id: null as string | null, code: "", name_ar: "", name_en: "",
    is_group: false, is_active: true, notes: "",
    stock_input_account_id: null as string | null, stock_output_account_id: null as string | null,
    costing_method: "fifo" as "standard" | "fifo" | "avco",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = (parentId?: string | null) => { setForm({ ...empty, parent_id: parentId ?? null }); setOpen(true); };
  const openEdit = (row: any) => { setForm({ id: row.id, parent_id: row.parent_id, code: row.code, name_ar: row.name_ar, name_en: row.name_en, is_group: row.is_group, is_active: row.is_active, notes: row.notes ?? "", stock_input_account_id: row.stock_input_account_id ?? null, stock_output_account_id: row.stock_output_account_id ?? null, costing_method: row.costing_method ?? "fifo" }); setOpen(true); };

  const saveMut = useMutation({
    mutationFn: () => upsertFn({ data: { ...form, company_id: companyId!, notes: form.notes || null } }),
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); qc.invalidateQueries({ queryKey: ["purchase_categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.deleted") || t("common.saved")); setDeleteId(null); qc.invalidateQueries({ queryKey: ["purchase_categories"] }); },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  const moveMut = useMutation({
    mutationFn: (payload: { id: string; sort_order: number }) => upsertFn({ data: { id: payload.id, company_id: companyId!, sort_order: payload.sort_order, code: rows.find((r: any) => r.id === payload.id)!.code, name_ar: rows.find((r: any) => r.id === payload.id)!.name_ar, name_en: rows.find((r: any) => r.id === payload.id)!.name_en, is_group: rows.find((r: any) => r.id === payload.id)!.is_group, parent_id: rows.find((r: any) => r.id === payload.id)!.parent_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase_categories"] }),
  });

  const onMove = (node: any, dir: -1 | 1) => {
    const siblings = tree[node.parent_id ?? "__root__"] ?? [];
    const idx = siblings.findIndex((s) => s.id === node.id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    moveMut.mutate({ id: node.id, sort_order: swapWith.sort_order ?? idx + dir });
    moveMut.mutate({ id: swapWith.id, sort_order: node.sort_order ?? idx });
  };

  const canSave = form.code.trim() && form.name_ar.trim() && form.name_en.trim();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openNew(null)} disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("purchase.newCategory")}</Button>
      </div>
      <Card className="p-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("common.loading")}</p>
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("common.noData")}</p>
        ) : (
          roots.map((r, i) => (
            <CategoryNode key={r.id} node={r} depth={0} index={i} siblingCount={roots.length} tree={tree} localized={localized} t={t} onAdd={openNew} onEdit={openEdit} onDelete={setDeleteId} onMove={onMove} />
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("purchase.newCategory")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("purchase.parentCategory")}</Label>
              <Select
                value={form.parent_id ?? "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v === "__none__" ? null : v }))}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("purchase.noParentRoot")}</SelectItem>
                  {(rows as any[])
                    .filter((r) => r.id !== form.id && !(form.id ? getDescendantIds(form.id).has(r.id) : false))
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.code} — {localized(r, "name")}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" /></div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_group} onCheckedChange={(v) => setForm((f) => ({ ...f, is_group: v }))} />
                <Label>{t("purchase.isGroup")}</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.name")} (AR)</Label><Input value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" /></div>
              <div><Label>{t("common.name")} (EN)</Label><Input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" /></div>
            </div>
            <div><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div>
              <Label>{t("purchase.costingMethod")}</Label>
              <Select value={form.costing_method} onValueChange={(v: any) => setForm((f) => ({ ...f, costing_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t("purchase.costingStandard")}</SelectItem>
                  <SelectItem value="fifo">{t("purchase.costingFifo")}</SelectItem>
                  <SelectItem value="avco">{t("purchase.costingAvco")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("purchase.stockInputAccount")}</Label>
                <AccountCombobox accounts={postableAccounts} value={form.stock_input_account_id} onChange={(v) => setForm((f) => ({ ...f, stock_input_account_id: v }))} />
              </div>
              <div>
                <Label>{t("purchase.stockOutputAccount")}</Label>
                <AccountCombobox accounts={postableAccounts} value={form.stock_output_account_id} onChange={(v) => setForm((f) => ({ ...f, stock_output_account_id: v }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>{t("common.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryNode({ node, depth, index, siblingCount, tree, localized, t, onAdd, onEdit, onDelete, onMove }: any) {
  const [open, setOpen] = useState(true);
  const children = tree[node.id] ?? [];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1.5 rounded-md px-2 py-2 hover:bg-muted/40 group" style={{ paddingInlineStart: `${8 + depth * 22}px` }}>
        <button type="button" onClick={() => setOpen((o: boolean) => !o)} className={"h-5 w-5 flex items-center justify-center shrink-0 rounded " + (hasChildren ? "text-muted-foreground hover:bg-muted" : "opacity-0 pointer-events-none")}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{localized(node, "name")}</span>
          <span className="text-xs text-muted-foreground font-mono">{node.code}</span>
          {node.is_group && <Badge variant="outline" className="text-[10px]">{t("purchase.isGroup")}</Badge>}
          {!node.is_active && <Badge variant="secondary" className="text-[10px]">{t("users.disabled")}</Badge>}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index <= 0} onClick={() => onMove(node, -1)}><ChevronUp className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index >= siblingCount - 1} onClick={() => onMove(node, 1)}><ChevronDown className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAdd(node.id)}><Plus className="h-3 w-3 me-1" />{t("common.new")}</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0" onClick={() => onEdit(node)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {open && children.map((c: any, i: number) => (
        <CategoryNode key={c.id} node={c} depth={depth + 1} index={i} siblingCount={children.length} tree={tree} localized={localized} t={t} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
      ))}
    </div>
  );
}
