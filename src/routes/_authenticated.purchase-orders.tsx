import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  upsertPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  listProducts,
  listUnitsOfMeasure,
  listWarehouses,
} from "@/lib/api/purchase.functions";
import { listPartners } from "@/lib/api/accounting.functions";
import { listTaxes } from "@/lib/api/vat.functions";
import { listPaymentTerms } from "@/lib/api/payment-terms.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCombobox } from "@/components/product-combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, ArrowLeft, X, Receipt } from "lucide-react";
import { toast } from "sonner";
import { POBILL_STAGING_KEY } from "@/lib/po-to-bill";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  component: Page,
});

const STATUSES = ["draft", "confirmed", "partially_received", "received", "cancelled"] as const;
const statusColor: Record<string, string> = {
  draft: "secondary",
  confirmed: "default",
  partially_received: "outline",
  received: "default",
  cancelled: "destructive",
};

function Page() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const listFn = useServerFn(listPurchaseOrders);
  const getFn = useServerFn(getPurchaseOrder);
  const upsertFn = useServerFn(upsertPurchaseOrder);
  const statusFn = useServerFn(updatePurchaseOrderStatus);
  const deleteFn = useServerFn(deletePurchaseOrder);
  const listPartnersFn = useServerFn(listPartners);
  const listProductsFn = useServerFn(listProducts);
  const listUomFn = useServerFn(listUnitsOfMeasure);
  const listTaxesFn = useServerFn(listTaxes);
  const listTermsFn = useServerFn(listPaymentTerms);
  const listWarehousesFn = useServerFn(listWarehouses);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["partners_for_po", companyId],
    queryFn: () => listPartnersFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const vendors = (partners as any[]).filter((p) => p.is_vendor);
  const { data: products = [] } = useQuery({
    queryKey: ["products", companyId],
    queryFn: () => listProductsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: uoms = [] } = useQuery({
    queryKey: ["units_of_measure", companyId],
    queryFn: () => listUomFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: allTaxes = [] } = useQuery({
    queryKey: ["taxes_for_po", companyId],
    queryFn: () => listTaxesFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const purchaseTaxes = (allTaxes as any[]).filter((t) => t.tax_type === "purchase" && t.is_active);
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["payment_terms_for_po", companyId],
    queryFn: () => listTermsFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_for_po", companyId],
    queryFn: () => listWarehousesFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const vendorName = (id: string) => {
    const v = vendors.find((v: any) => v.id === id);
    return v ? `${v.code} — ${localized(v, "name")}` : "—";
  };

  type Line = {
    id?: string; product_id: string | null; description: string; quantity: number; uom_id: string | null;
    unit_price: number; bonus: number; discount1_pct: number; discount2_pct: number; tax_id: string | null; tax_rate: number;
  };
  const emptyLine: Line = { product_id: null, description: "", quantity: 1, uom_id: null, unit_price: 0, bonus: 0, discount1_pct: 0, discount2_pct: 0, tax_id: null, tax_rate: 0 };
  const empty = {
    id: undefined as string | undefined,
    vendor_id: "",
    vendor_reference: "",
    warehouse_id: null as string | null,
    bill_control: "received" as "ordered" | "received",
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: "",
    payment_term_id: null as string | null,
    notes: "",
    lines: [{ ...emptyLine }] as Line[],
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = async (id: string) => {
    const po: any = await getFn({ data: { id } });
    setForm({
      id: po.id,
      vendor_id: po.vendor_id,
      vendor_reference: po.vendor_reference ?? "",
      warehouse_id: po.warehouse_id ?? null,
      bill_control: po.bill_control ?? "received",
      order_date: po.order_date,
      expected_delivery_date: po.expected_delivery_date ?? "",
      payment_term_id: po.payment_term_id ?? null,
      notes: po.notes ?? "",
      lines: po.lines.map((l: any) => ({
        id: l.id, product_id: l.product_id, description: l.description ?? "",
        quantity: Number(l.quantity), uom_id: l.uom_id, unit_price: Number(l.unit_price),
        bonus: Number(l.bonus ?? 0), discount1_pct: Number(l.discount1_pct ?? 0), discount2_pct: Number(l.discount2_pct ?? 0),
        tax_id: l.tax_id ?? null, tax_rate: Number(l.tax_rate ?? 0),
      })),
    });
    setOpen(true);
  };

  const setLine = (idx: number, patch: Partial<Line>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, { ...emptyLine }] }));
  const removeLine = (idx: number) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const onProductPick = (idx: number, productId: string) => {
    const p = (products as any[]).find((p) => p.id === productId);
    setLine(idx, {
      product_id: productId,
      unit_price: p ? Number(p.cost_price) : 0,
      uom_id: p?.purchase_uom_id ?? null,
      description: "",
    });
  };

  const onTaxPick = (idx: number, taxId: string) => {
    const tx = purchaseTaxes.find((t: any) => t.id === taxId);
    setLine(idx, { tax_id: taxId === "__none__" ? null : taxId, tax_rate: tx ? Number(tx.rate) : 0 });
  };

  const lineTotal = (l: Line) => {
    const base = (l.quantity || 0) * (l.unit_price || 0);
    const afterDisc1 = base * (1 - (l.discount1_pct || 0) / 100);
    const afterDisc2 = afterDisc1 * (1 - (l.discount2_pct || 0) / 100);
    return afterDisc2 * (1 + (l.tax_rate || 0) / 100);
  };

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of form.lines) {
      const base = (l.quantity || 0) * (l.unit_price || 0);
      const afterDisc1 = base * (1 - (l.discount1_pct || 0) / 100);
      const afterDisc2 = afterDisc1 * (1 - (l.discount2_pct || 0) / 100);
      subtotal += afterDisc2;
      tax += afterDisc2 * ((l.tax_rate || 0) / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [form.lines]);

  const saveMut = useMutation({
    mutationFn: async () => {
      setSaving(true);
      await upsertFn({
        data: {
          id: form.id,
          company_id: companyId!,
          branch_id: branchId ?? null,
          vendor_id: form.vendor_id,
          vendor_reference: form.vendor_reference || null,
          warehouse_id: form.warehouse_id,
          bill_control: form.bill_control,
          order_date: form.order_date,
          expected_delivery_date: form.expected_delivery_date || null,
          payment_term_id: form.payment_term_id,
          notes: form.notes || null,
          lines: form.lines
            .filter((l) => l.product_id || l.description)
            .map((l) => ({
              id: l.id,
              product_id: l.product_id,
              description: l.description || null,
              quantity: Number(l.quantity),
              uom_id: l.uom_id,
              unit_price: Number(l.unit_price),
              bonus: Number(l.bonus) || 0,
              discount1_pct: Number(l.discount1_pct) || 0,
              discount2_pct: Number(l.discount2_pct) || 0,
              tax_id: l.tax_id,
              tax_rate: Number(l.tax_rate) || 0,
            })),
        },
      });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      setOpen(false);
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    },
    onError: (e: Error) => { toast.error(e.message); setSaving(false); },
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => statusFn({ data: v }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["purchase_orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.saved")); setDeleteId(null); qc.invalidateQueries({ queryKey: ["purchase_orders"] }); },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  // "Create Bill" only makes sense once the order has reached the stage
  // its own Bill Control policy requires: bill off what was ordered as
  // soon as it's confirmed, or wait until it's actually received.
  const canCreateBill = (o: any) =>
    o.bill_control === "ordered" ? o.status === "confirmed" : o.status === "received";

  const createBillFrom = async (id: string) => {
    const po: any = await getFn({ data: { id } });
    const draft = {
      purchase_order_id: po.id,
      vendor_id: po.vendor_id,
      reference: po.po_number,
      lines: (po.lines as any[]).map((l) => {
        const netUnitPrice = Number(l.unit_price) * (1 - Number(l.discount1_pct || 0) / 100) * (1 - Number(l.discount2_pct || 0) / 100);
        const product = (products as any[]).find((p) => p.id === l.product_id);
        return {
          description: l.description || (product ? localized(product, "name") : ""),
          product_id: l.product_id,
          account_id: product?.expense_account_id ?? null,
          quantity: Number(l.quantity),
          unit_price: Math.round(netUnitPrice * 10000) / 10000,
          tax_id: l.tax_id,
          tax_rate: Number(l.tax_rate || 0),
        };
      }),
    };
    sessionStorage.setItem(POBILL_STAGING_KEY, JSON.stringify(draft));
    navigate({ to: "/invoices/vendor" });
  };

  const canSave = !!form.vendor_id && form.lines.some((l) => l.product_id || l.description) && form.lines.every((l) => l.quantity > 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/apps"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseProcurement")}</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="page-title">{t("nav.purchaseOrders")}</h1>
        </div>
        <Button size="sm" onClick={openNew} disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("purchase.newOrder")}</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2.5 text-start">{t("purchase.poNumber")}</th>
              <th className="p-2.5 text-start">{t("purchase.vendor")}</th>
              <th className="p-2.5 text-start">{t("purchase.orderDate")}</th>
              <th className="p-2.5 text-start">{t("purchase.total")}</th>
              <th className="p-2.5 text-center">{t("common.status")}</th>
              <th className="p-2.5 text-center">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              (orders as any[]).map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/20">
                  <td className="p-2.5 font-mono text-xs">{o.po_number}</td>
                  <td className="p-2.5">{vendorName(o.vendor_id)}</td>
                  <td className="p-2.5 text-muted-foreground">{o.order_date}</td>
                  <td className="p-2.5 font-mono">{Number(o.total).toFixed(2)} {o.currency_code}</td>
                  <td className="p-2.5 text-center">
                    <Select value={o.status} onValueChange={(v) => statusMut.mutate({ id: o.id, status: v })}>
                      <SelectTrigger className="h-7 text-[11px] w-auto inline-flex">
                        <Badge variant={statusColor[o.status] as any} className="text-[10.5px]">{t(`purchase.status.${o.status}`)}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`purchase.status.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        disabled={!canCreateBill(o)}
                        title={!canCreateBill(o) ? t("purchase.createBillDisabledHint") : undefined}
                        onClick={() => createBillFrom(o.id)}
                      >
                        <Receipt className="h-3 w-3" />
                        {t("purchase.createBill")}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("purchase.newOrder")} — {t("nav.purchaseOrders")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>{t("purchase.vendor")} *</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.code} — {localized(v, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("purchase.orderDate")}</Label>
                <Input type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div>
                <Label>{t("purchase.expectedDelivery")}</Label>
                <Input type="date" value={form.expected_delivery_date} onChange={(e) => setForm((f) => ({ ...f, expected_delivery_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t("purchase.vendorReference")}</Label>
                <Input value={form.vendor_reference} onChange={(e) => setForm((f) => ({ ...f, vendor_reference: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t("purchase.deliverTo")}</Label>
                <Select value={form.warehouse_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v === "__none__" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(warehouses as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {localized(w, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("purchase.billControl")}</Label>
                <Select value={form.bill_control} onValueChange={(v: any) => setForm((f) => ({ ...f, bill_control: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordered">{t("purchase.billControlOrdered")}</SelectItem>
                    <SelectItem value="received">{t("purchase.billControlReceived")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{t("purchase.lines")}</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 me-1" />{t("purchase.addLine")}</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs min-w-[880px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-start">{t("purchase.product")}</th>
                      <th className="p-2 text-start w-16">{t("purchase.qty")}</th>
                      <th className="p-2 text-start w-24">{t("purchase.uom")}</th>
                      <th className="p-2 text-start w-20">{t("purchase.unitPrice")}</th>
                      <th className="p-2 text-start w-16">{t("purchase.bonus")}</th>
                      <th className="p-2 text-start w-16">{t("purchase.disc1")}</th>
                      <th className="p-2 text-start w-16">{t("purchase.disc2")}</th>
                      <th className="p-2 text-start w-28">{t("purchase.tax")}</th>
                      <th className="p-2 text-end w-24">{t("purchase.lineTotal")}</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1.5 min-w-[220px]">
                          <ProductCombobox
                            products={products as any[]}
                            value={l.product_id}
                            onChange={(id) => onProductPick(idx, id ?? "")}
                            triggerClassName="h-8 text-xs"
                          />
                        </td>
                        <td className="p-1.5"><Input type="number" step="0.01" className="h-8 text-xs" value={l.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} /></td>
                        <td className="p-1.5">
                          {l.product_id ? (
                            <Input
                              readOnly
                              disabled
                              className="h-8 text-xs bg-muted cursor-not-allowed"
                              value={(uoms as any[]).find((u: any) => u.id === l.uom_id) ? localized((uoms as any[]).find((u: any) => u.id === l.uom_id), "name") : "—"}
                              title={t("purchase.uomLockedHint")}
                            />
                          ) : (
                            <Select value={l.uom_id ?? "__none__"} onValueChange={(v) => setLine(idx, { uom_id: v === "__none__" ? null : v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">—</SelectItem>
                                {(uoms as any[]).map((u) => <SelectItem key={u.id} value={u.id}>{localized(u, "name")}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-1.5"><Input type="number" step="0.01" className="h-8 text-xs" value={l.unit_price} onChange={(e) => setLine(idx, { unit_price: Number(e.target.value) })} /></td>
                        <td className="p-1.5"><Input type="number" step="0.01" className="h-8 text-xs" value={l.bonus} onChange={(e) => setLine(idx, { bonus: Number(e.target.value) })} title={t("purchase.bonusHint")} /></td>
                        <td className="p-1.5"><Input type="number" step="0.1" className="h-8 text-xs" value={l.discount1_pct} onChange={(e) => setLine(idx, { discount1_pct: Number(e.target.value) })} /></td>
                        <td className="p-1.5"><Input type="number" step="0.1" className="h-8 text-xs" value={l.discount2_pct} onChange={(e) => setLine(idx, { discount2_pct: Number(e.target.value) })} /></td>
                        <td className="p-1.5">
                          <Select value={l.tax_id ?? "__none__"} onValueChange={(v) => onTaxPick(idx, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {purchaseTaxes.map((tx: any) => <SelectItem key={tx.id} value={tx.id}>{localized(tx, "name")} ({Number(tx.rate)}%)</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1.5 text-end font-mono">{lineTotal(l).toFixed(2)}</td>
                        <td className="p-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(idx)} disabled={form.lines.length === 1}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>{t("purchase.subtotal")}</span><span className="font-mono">{totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>{t("purchase.taxTotal")}</span><span className="font-mono">{totals.tax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>{t("purchase.total")}</span><span className="font-mono">{totals.total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("purchase.paymentTerms")}</Label>
                <Select value={form.payment_term_id ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, payment_term_id: v === "__none__" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(paymentTerms as any[]).map((pt) => <SelectItem key={pt.id} value={pt.id}>{localized(pt, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.notes")}</Label><Textarea rows={1} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
