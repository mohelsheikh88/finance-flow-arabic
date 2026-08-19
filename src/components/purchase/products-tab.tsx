import { useMemo, useRef, useState } from "react";
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
  listProductTypes,
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
  Plus, Pencil, Trash2, ShieldAlert, Snowflake, Boxes, Barcode, FileDown, FileUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// GS1 "restricted circulation" prefix (200-299) is reserved for a
// company's own internal use, so it's safe to generate these locally
// without registering with GS1.
function generateEAN13(): string {
  let body = "20";
  for (let i = 0; i < 10; i++) body += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(body[i], 10) * (i % 2 === 0 ? 1 : 3);
  const checkDigit = (10 - (sum % 10)) % 10;
  return body + checkDigit;
}

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
  const listTypesFn = useServerFn(listProductTypes);

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
  const { data: productTypes = [] } = useQuery({
    queryKey: ["product_types", companyId],
    queryFn: () => listTypesFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const activeProductTypes = (productTypes as any[]).filter((pt) => pt.is_active);

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
    category_id: null as string | null, product_type_id: null as string | null,
    purchase_uom_id: null as string | null, cost_price: 0, expense_account_id: null as string | null,
    requires_batch_tracking: false, requires_expiry_tracking: false, requires_cold_chain: false,
    is_controlled_substance: false, requires_prescription: false, regulatory_number: "", barcode: "", reorder_point: "" as any,
    is_active: true, notes: "",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const selectedType = activeProductTypes.find((pt) => pt.id === form.product_type_id) ?? (productTypes as any[]).find((pt) => pt.id === form.product_type_id);
  const tracksInventory = selectedType ? !!selectedType.tracks_inventory : true;

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id, code: p.code, name_ar: p.name_ar, name_en: p.name_en,
      category_id: p.category_id, product_type_id: p.product_type_id, purchase_uom_id: p.purchase_uom_id,
      cost_price: p.cost_price, expense_account_id: p.expense_account_id,
      requires_batch_tracking: p.requires_batch_tracking, requires_expiry_tracking: p.requires_expiry_tracking,
      requires_cold_chain: p.requires_cold_chain, is_controlled_substance: p.is_controlled_substance,
      requires_prescription: p.requires_prescription, regulatory_number: p.regulatory_number ?? "", barcode: p.barcode ?? "",
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
        barcode: form.barcode || null,
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

  const canSave = !!(
    form.code.trim() && form.name_ar.trim() && form.name_en.trim() &&
    form.regulatory_number.trim() && form.category_id && form.barcode.trim() && form.product_type_id &&
    (tracksInventory ? form.purchase_uom_id && String(form.reorder_point).trim() : form.expense_account_id)
  );
  const typeLabel = (id: string | null) => {
    if (!id) return "—";
    const pt = (productTypes as any[]).find((p) => p.id === id);
    return pt ? localized(pt, "name") : "—";
  };

  // ===== Export / Import (matches by row `id` — same id on re-import = update) =====
  const categoryByCode = new Map((categories as any[]).filter((c) => !c.is_group).map((c) => [String(c.code).toLowerCase(), c]));
  const typeByCode = new Map((productTypes as any[]).map((pt) => [String(pt.code).toLowerCase(), pt]));
  const uomByCode = new Map((uoms as any[]).map((u: any) => [String(u.code).toLowerCase(), u]));
  const accountByCode = new Map((accounts as any[]).map((a: any) => [String(a.code).toLowerCase(), a]));

  const handleExport = () => {
    const data = (products as any[]).map((p) => {
      const pt = (productTypes as any[]).find((x) => x.id === p.product_type_id);
      return {
        id: p.id,
        code: p.code,
        name_ar: p.name_ar,
        name_en: p.name_en,
        category_code: (categories as any[]).find((c) => c.id === p.category_id)?.code ?? "",
        product_type_code: pt?.code ?? "",
        uom_code: (uoms as any[]).find((u: any) => u.id === p.purchase_uom_id)?.code ?? "",
        expense_account_code: (accounts as any[]).find((a: any) => a.id === p.expense_account_id)?.code ?? "",
        cost_price: p.cost_price,
        reorder_point: p.reorder_point ?? "",
        regulatory_number: p.regulatory_number ?? "",
        barcode: p.barcode ?? "",
        requires_batch_tracking: p.requires_batch_tracking ? 1 : 0,
        requires_expiry_tracking: p.requires_expiry_tracking ? 1 : 0,
        requires_cold_chain: p.requires_cold_chain ? 1 : 0,
        is_controlled_substance: p.is_controlled_substance ? 1 : 0,
        requires_prescription: p.requires_prescription ? 1 : 0,
        is_active: p.is_active ? 1 : 0,
        notes: p.notes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{
      id: "", code: "", name_ar: "", name_en: "", category_code: "", product_type_code: "",
      uom_code: "", expense_account_code: "", cost_price: 0, reorder_point: "", regulatory_number: "",
      barcode: "", requires_batch_tracking: 0, requires_expiry_tracking: 0, requires_cold_chain: 0,
      is_controlled_substance: 0, requires_prescription: 0, is_active: 1, notes: "",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "products");
    XLSX.writeFile(wb, `products_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const handleUploadClick = () => fileInputRef.current?.click();

  const toBool = (v: any) => !["0", "false", "no", "", undefined, null].includes(String(v).trim().toLowerCase());

  const handleFileSelected = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !companyId) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
      if (jsonRows.length === 0) { toast.error(t("common.emptyFile") || "Empty file"); return; }

      const existingById = new Map((products as any[]).map((p) => [p.id, p]));
      let created = 0, updated = 0, failed = 0;
      const errors: string[] = [];

      for (const raw of jsonRows) {
        const code = String(raw.code ?? "").trim();
        const name_ar = String(raw.name_ar ?? "").trim();
        const name_en = String(raw.name_en ?? "").trim();
        const category = categoryByCode.get(String(raw.category_code ?? "").trim().toLowerCase());
        const productType = typeByCode.get(String(raw.product_type_code ?? "").trim().toLowerCase());
        const regulatory_number = String(raw.regulatory_number ?? "").trim();
        const barcode = String(raw.barcode ?? "").trim();
        const rowId = String(raw.id ?? "").trim();
        const existing = rowId ? existingById.get(rowId) : undefined;

        if (!code || !name_ar || !name_en || !category || !productType || !regulatory_number || !barcode) {
          failed++; errors.push(code || raw.id || t("common.unnamed") || "row");
          continue;
        }

        const uom = uomByCode.get(String(raw.uom_code ?? "").trim().toLowerCase());
        const expenseAccount = accountByCode.get(String(raw.expense_account_code ?? "").trim().toLowerCase());
        const reorder = String(raw.reorder_point ?? "").trim();

        if (productType.tracks_inventory ? (!uom || reorder === "") : !expenseAccount) {
          failed++; errors.push(code);
          continue;
        }

        try {
          await upsertFn({
            data: {
              ...(existing ? { id: existing.id } : {}),
              company_id: companyId,
              code, name_ar, name_en,
              category_id: category.id,
              product_type_id: productType.id,
              purchase_uom_id: uom?.id ?? null,
              expense_account_id: expenseAccount?.id ?? null,
              cost_price: Number(raw.cost_price) || 0,
              reorder_point: reorder === "" ? null : Number(reorder),
              regulatory_number, barcode,
              requires_batch_tracking: toBool(raw.requires_batch_tracking),
              requires_expiry_tracking: toBool(raw.requires_expiry_tracking),
              requires_cold_chain: toBool(raw.requires_cold_chain),
              is_controlled_substance: toBool(raw.is_controlled_substance),
              requires_prescription: toBool(raw.requires_prescription),
              is_active: raw.is_active === "" ? true : toBool(raw.is_active),
              notes: raw.notes ? String(raw.notes) : null,
            } as any,
          });
          if (existing) updated++; else created++;
        } catch {
          failed++; errors.push(code);
        }
      }

      qc.invalidateQueries({ queryKey: ["products"] });
      if (failed === 0) {
        toast.success(`${created} ${t("common.new") || "new"}, ${updated} ${t("common.updated") || "updated"}`);
      } else {
        toast.error(`${created + updated} ${t("common.saved")}, ${failed} ${t("common.failed") || "failed"}: ${errors.slice(0, 5).join(", ")}${errors.length > 5 ? "…" : ""}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? t("common.error"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelected} />
      {mode === "all" && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!companyId}>
            <FileDown className="h-4 w-4 me-1" />{t("common.export") || "Export"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleUploadClick} disabled={!companyId || importing}>
            <FileUp className="h-4 w-4 me-1" />{importing ? "…" : (t("common.import") || "Import")}
          </Button>
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
                  <td className="p-2.5"><Badge variant="outline" className="text-[10.5px]">{typeLabel(p.product_type_id)}</Badge></td>
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
                <div><Label>{t("purchase.internalCode")} *</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" /></div>
                <div><Label>{t("purchase.regulatoryNumber")} *</Label><Input value={form.regulatory_number} onChange={(e) => setForm((f) => ({ ...f, regulatory_number: e.target.value }))} dir="ltr" /></div>
                <div><Label>{t("common.name")} (AR) *</Label><Input value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" /></div>
                <div><Label>{t("common.name")} (EN) *</Label><Input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" /></div>
                <div>
                  <Label>{t("purchase.productType")} *</Label>
                  <Select value={form.product_type_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, product_type_id: v === "__none__" ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {activeProductTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>{localized(pt, "name")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("purchase.category")} *</Label>
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
                {tracksInventory ? (
                  <div>
                    <Label>{t("purchase.uom")} *</Label>
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
                    <Label>{t("purchase.expenseAccount")} *</Label>
                    <AccountCombobox accounts={accounts as any[]} value={form.expense_account_id} onChange={(v) => setForm((f) => ({ ...f, expense_account_id: v }))} />
                  </div>
                )}
                <div><Label>{t("purchase.costPrice")} *</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: Number(e.target.value) }))} /></div>
                {tracksInventory && (
                  <div><Label>{t("purchase.reorderPoint")} *</Label><Input type="number" step="0.01" value={form.reorder_point} onChange={(e) => setForm((f) => ({ ...f, reorder_point: e.target.value }))} /></div>
                )}
                <div>
                  <Label>{t("purchase.barcode")} *</Label>
                  <div className="flex gap-2">
                    <Input value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value.replace(/[^0-9]/g, "") }))} dir="ltr" className="flex-1" />
                    <Button type="button" variant="outline" size="icon" title={t("purchase.generateBarcode")} onClick={() => setForm((f) => ({ ...f, barcode: generateEAN13() }))}>
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
