import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import {
  listProducts,
  upsertProduct,
  deleteProduct,
  listPurchaseCategories,
  listUnitsOfMeasure,
} from "@/lib/api/purchase.functions";
import { listAccounts } from "@/lib/api/accounting.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Plus, Pencil, Trash2, ShieldAlert, Snowflake, Boxes,
} from "lucide-react";
import { toast } from "sonner";

/* ============================== Products Tab ============================== */

export function ProductsTab({ mode }: { mode: "all" | "compliance" }) {
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
                    <AccountCombobox accounts={accounts as any[]} value={form.expense_account_id} onChange={(v) => setForm((f) => ({ ...f, expense_account_id: v }))} />
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
