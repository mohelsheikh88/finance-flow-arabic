import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import {
  listPurchaseCategories,
  upsertPurchaseCategory,
  deletePurchaseCategory,
  listProducts,
  upsertProduct,
  deleteProduct,
  listUnitsOfMeasure,
} from "@/lib/api/purchase.functions";
import { listAccounts } from "@/lib/api/accounting.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, Tags,
  ShieldAlert, Snowflake, Boxes, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/product-management")({
  component: Page,
});

function Page() {
  const { t } = useI18n();

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/apps"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseProcurement")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Tags className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("nav.productManagement")}</h1>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">{t("purchase.productCategories")}</TabsTrigger>
          <TabsTrigger value="products">{t("purchase.products")}</TabsTrigger>
          <TabsTrigger value="compliance">{t("purchase.complianceTracking")}</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab mode="all" />
        </TabsContent>
        <TabsContent value="compliance" className="mt-4">
          <ProductsTab mode="compliance" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Categories Tab ============================== */

function CategoriesTab() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listFn = useServerFn(listPurchaseCategories);
  const upsertFn = useServerFn(upsertPurchaseCategory);
  const deleteFn = useServerFn(deletePurchaseCategory);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchase_categories", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const tree = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of rows as any[]) {
      const key = r.parent_id ?? "__root__";
      (map[key] ??= []).push(r);
    }
    return map;
  }, [rows]);
  const roots = tree["__root__"] ?? [];

  const empty = { id: undefined as string | undefined, parent_id: null as string | null, code: "", name_ar: "", name_en: "", is_group: false, is_active: true, notes: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = (parentId?: string | null) => { setForm({ ...empty, parent_id: parentId ?? null }); setOpen(true); };
  const openEdit = (row: any) => { setForm({ id: row.id, parent_id: row.parent_id, code: row.code, name_ar: row.name_ar, name_en: row.name_en, is_group: row.is_group, is_active: row.is_active, notes: row.notes ?? "" }); setOpen(true); };

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

/* ============================== Products Tab ============================== */

function ProductsTab({ mode }: { mode: "all" | "compliance" }) {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const upsertFn = useServerFn(upsertProduct);
  const deleteFn = useServerFn(deleteProduct);
  const listCatFn = useServerFn(listPurchaseCategories);
  const listUomFn = useServerFn(listUnitsOfMeasure);
  const listAccFn = useServerFn(listAccounts);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["purchase_categories", companyId],
    queryFn: () => listCatFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: uoms = [] } = useQuery({
    queryKey: ["units_of_measure", companyId],
    queryFn: () => listUomFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts_for_products", companyId],
    queryFn: () => listAccFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId && mode === "all",
  });

  const catName = (id: string | null) => (id ? localized(categories.find((c: any) => c.id === id) ?? {}, "name") || "—" : "—");
  const uomName = (id: string | null) => (id ? localized(uoms.find((u: any) => u.id === id) ?? {}, "name") || "—" : "—");

  const visibleProducts = useMemo(() => {
    if (mode === "all") return products;
    return (products as any[]).filter((p) =>
      p.requires_batch_tracking || p.requires_expiry_tracking || p.requires_cold_chain || p.is_controlled_substance || p.requires_prescription || p.regulatory_number
    );
  }, [products, mode]);

  const empty = {
    id: undefined as string | undefined, code: "", name_ar: "", name_en: "",
    category_id: null as string | null, product_type: "good" as "good" | "service" | "other",
    purchase_uom_id: null as string | null, cost_price: 0, expense_account_id: null as string | null,
    requires_batch_tracking: false, requires_expiry_tracking: false, requires_cold_chain: false,
    is_controlled_substance: false, requires_prescription: false, regulatory_number: "", reorder_point: "" as any,
    is_active: true, notes: "",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id, code: p.code, name_ar: p.name_ar, name_en: p.name_en,
      category_id: p.category_id, product_type: p.product_type, purchase_uom_id: p.purchase_uom_id,
      cost_price: p.cost_price, expense_account_id: p.expense_account_id,
      requires_batch_tracking: p.requires_batch_tracking, requires_expiry_tracking: p.requires_expiry_tracking,
      requires_cold_chain: p.requires_cold_chain, is_controlled_substance: p.is_controlled_substance,
      requires_prescription: p.requires_prescription, regulatory_number: p.regulatory_number ?? "",
      reorder_point: p.reorder_point ?? "", is_active: p.is_active, notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => upsertFn({
      data: {
        ...form,
        company_id: companyId!,
        regulatory_number: form.regulatory_number || null,
        reorder_point: form.reorder_point === "" ? null : Number(form.reorder_point),
        notes: form.notes || null,
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.saved")); setDeleteId(null); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  const canSave = form.code.trim() && form.name_ar.trim() && form.name_en.trim();
  const typeLabel = (v: string) => (v === "good" ? t("purchase.typeGood") : v === "service" ? t("purchase.typeService") : t("purchase.typeOther"));

  return (
    <div className="space-y-3">
      {mode === "all" && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openNew} disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("purchase.newProduct")}</Button>
        </div>
      )}

      {mode === "compliance" && (
        <p className="text-xs text-muted-foreground">{t("purchase.complianceTabHint")}</p>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-start">
              <th className="p-2.5 text-start">{t("common.code")}</th>
              <th className="p-2.5 text-start">{t("common.name")}</th>
              <th className="p-2.5 text-start">{t("purchase.category")}</th>
              <th className="p-2.5 text-start">{t("purchase.productType")}</th>
              {mode === "all" ? (
                <>
                  <th className="p-2.5 text-start">{t("purchase.uom")}</th>
                  <th className="p-2.5 text-start">{t("purchase.costPrice")}</th>
                </>
              ) : (
                <th className="p-2.5 text-start">{t("purchase.complianceFlags")}</th>
              )}
              <th className="p-2.5 text-center">{t("common.status")}</th>
              {mode === "all" && <th className="p-2.5 text-center">{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : visibleProducts.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              (visibleProducts as any[]).map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="p-2.5 font-mono text-xs">{p.code}</td>
                  <td className="p-2.5">{localized(p, "name")}</td>
                  <td className="p-2.5 text-muted-foreground">{catName(p.category_id)}</td>
                  <td className="p-2.5"><Badge variant="outline" className="text-[10.5px]">{typeLabel(p.product_type)}</Badge></td>
                  {mode === "all" ? (
                    <>
                      <td className="p-2.5 text-muted-foreground">{uomName(p.purchase_uom_id)}</td>
                      <td className="p-2.5 font-mono">{Number(p.cost_price).toFixed(2)}</td>
                    </>
                  ) : (
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.requires_batch_tracking && <Badge variant="outline" className="text-[10px] gap-1"><Boxes className="h-3 w-3" />{t("purchase.batch")}</Badge>}
                        {p.requires_expiry_tracking && <Badge variant="outline" className="text-[10px]">{t("purchase.expiry")}</Badge>}
                        {p.requires_cold_chain && <Badge variant="outline" className="text-[10px] gap-1"><Snowflake className="h-3 w-3" />{t("purchase.coldChain")}</Badge>}
                        {p.is_controlled_substance && <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive"><ShieldAlert className="h-3 w-3" />{t("purchase.controlled")}</Badge>}
                        {p.requires_prescription && <Badge variant="outline" className="text-[10px]">{t("purchase.prescription")}</Badge>}
                        {p.regulatory_number && <Badge variant="outline" className="text-[10px] font-mono">{p.regulatory_number}</Badge>}
                      </div>
                    </td>
                  )}
                  <td className="p-2.5 text-center"><Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? t("common.active") : t("users.disabled")}</Badge></td>
                  {mode === "all" && (
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("purchase.newProduct")}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("purchase.generalInfo")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" /></div>
                <div>
                  <Label>{t("purchase.productType")}</Label>
                  <Select value={form.product_type} onValueChange={(v: any) => setForm((f) => ({ ...f, product_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">{t("purchase.typeGood")}</SelectItem>
                      <SelectItem value="service">{t("purchase.typeService")}</SelectItem>
                      <SelectItem value="other">{t("purchase.typeOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("common.name")} (AR)</Label><Input value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" /></div>
                <div><Label>{t("common.name")} (EN)</Label><Input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" /></div>
                <div>
                  <Label>{t("purchase.category")}</Label>
                  <Select value={form.category_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none__" ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(categories as any[]).filter((c) => !c.is_group).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{localized(c, "name")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("purchase.pricingUom")}</p>
              <div className="grid grid-cols-2 gap-3">
                {form.product_type === "good" ? (
                  <div>
                    <Label>{t("purchase.uom")}</Label>
                    <Select value={form.purchase_uom_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, purchase_uom_id: v === "__none__" ? null : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {(uoms as any[]).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{localized(u, "name")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>{t("purchase.expenseAccount")}</Label>
                    <Select value={form.expense_account_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, expense_account_id: v === "__none__" ? null : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {(accounts as any[]).filter((a) => !a.is_group).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.code} — {localized(a, "name")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label>{t("purchase.costPrice")}</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: Number(e.target.value) }))} /></div>
                {form.product_type === "good" && (
                  <div><Label>{t("purchase.reorderPoint")}</Label><Input type="number" step="0.01" value={form.reorder_point} onChange={(e) => setForm((f) => ({ ...f, reorder_point: e.target.value }))} /></div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("purchase.complianceTracking")}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40">
                  <Switch checked={form.requires_batch_tracking} onCheckedChange={(v) => setForm((f) => ({ ...f, requires_batch_tracking: v }))} />
                  {t("purchase.batch")}
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40">
                  <Switch checked={form.requires_expiry_tracking} onCheckedChange={(v) => setForm((f) => ({ ...f, requires_expiry_tracking: v }))} />
                  {t("purchase.expiry")}
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40">
                  <Switch checked={form.requires_cold_chain} onCheckedChange={(v) => setForm((f) => ({ ...f, requires_cold_chain: v }))} />
                  {t("purchase.coldChain")}
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40">
                  <Switch checked={form.is_controlled_substance} onCheckedChange={(v) => setForm((f) => ({ ...f, is_controlled_substance: v }))} />
                  {t("purchase.controlled")}
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40">
                  <Switch checked={form.requires_prescription} onCheckedChange={(v) => setForm((f) => ({ ...f, requires_prescription: v }))} />
                  {t("purchase.prescription")}
                </label>
                <div><Label>{t("purchase.regulatoryNumber")}</Label><Input value={form.regulatory_number} onChange={(e) => setForm((f) => ({ ...f, regulatory_number: e.target.value }))} dir="ltr" /></div>
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
