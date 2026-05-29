import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createInvoice, listInvoices, postInvoice } from "@/lib/api/invoices.functions";
import { listAccounts, listPartners } from "@/lib/api/accounting.functions";
import { listTaxes } from "@/lib/api/vat.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApprovalCell } from "@/components/approval-cell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatLockError } from "@/lib/lock-error";

export const Route = createFileRoute("/_authenticated/invoices/vendor")({
  component: VendorBillsPage,
});

type Line = { description: string; account_id: string; quantity: number; unit_price: number; tax_id: string; tax_rate: number };

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function statusBadge(s: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    posted: "bg-info/10 text-info border-info/30",
    paid: "bg-success/10 text-success border-success/30",
    partially_paid: "bg-warning/10 text-warning border-warning/30",
    cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[s] || ""}>{t(`je.${s}`) || s}</Badge>;
}

function VendorBillsPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listInvoices);
  const create = useServerFn(createInvoice);
  const post = useServerFn(postInvoice);
  const accFn = useServerFn(listAccounts);
  const partFn = useServerFn(listPartners);
  const taxFn = useServerFn(listTaxes);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", branchId, "vendor"],
    queryFn: () => list({ data: { branchId: branchId!, invoiceType: "vendor" } }),
    enabled: !!branchId,
  });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts", companyId], queryFn: () => accFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: partners = [] } = useQuery({ queryKey: ["partners", companyId], queryFn: () => partFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: taxes = [] } = useQuery({ queryKey: ["taxes", companyId], queryFn: () => taxFn({ data: { companyId: companyId! } }), enabled: !!companyId });

  const vendors = partners.filter((p: any) => p.is_vendor);
  const expenseAccounts = accounts.filter((a: any) => !a.is_group && (a.account_type === "expense" || a.account_type === "asset"));
  const purchaseTaxes = taxes.filter((tx: any) => tx.tax_type === "purchase");

  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState({
    partner_id: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    reference: "",
  });
  const [lines, setLines] = useState<Line[]>([
    { description: "", account_id: "", quantity: 1, unit_price: 0, tax_id: "", tax_rate: 15 },
  ]);

  const totals = useMemo(() => {
    let subtotal = 0, taxAmt = 0;
    lines.forEach((l) => {
      const s = l.quantity * l.unit_price;
      subtotal += s; taxAmt += s * (l.tax_rate / 100);
    });
    return { subtotal, taxAmt, total: subtotal + taxAmt };
  }, [lines]);

  const reset = () => {
    setHeader({ partner_id: "", invoice_date: new Date().toISOString().slice(0, 10), due_date: "", reference: "" });
    setLines([{ description: "", account_id: "", quantity: 1, unit_price: 0, tax_id: "", tax_rate: 15 }]);
  };

  const createMut = useMutation({
    mutationFn: (status: "draft" | "posted") => create({ data: {
      company_id: companyId!,
      branch_id: branchId!,
      invoice_type: "vendor",
      partner_id: header.partner_id,
      invoice_date: header.invoice_date,
      due_date: header.due_date || null,
      reference: header.reference || null,
      status,
      lines: lines.map((l) => ({
        description: l.description || null,
        account_id: l.account_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_id: l.tax_id || null,
        tax_rate: l.tax_rate,
      })),
    } as any }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  const postMut = useMutation({
    mutationFn: (id: string) => post({ data: { id } }),
    onSuccess: () => { toast.success(t("invoices.posted")); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  const canSave = header.partner_id && header.invoice_date && lines.every((l) => l.account_id && l.quantity > 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("nav.vendorBills")}</h1>
          <p className="text-sm text-muted-foreground">{invoices.length}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t("invoices.new")}</Button></DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("invoices.new")} — {t("nav.vendorBills")}</DialogTitle></DialogHeader>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>{t("invoices.vendor")} *</Label>
                <Select value={header.partner_id} onValueChange={(v) => setHeader({ ...header, partner_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("invoices.date")} *</Label><Input type="date" value={header.invoice_date} onChange={(e) => setHeader({ ...header, invoice_date: e.target.value })} /></div>
              <div><Label>{t("invoices.dueDate")}</Label><Input type="date" value={header.due_date} onChange={(e) => setHeader({ ...header, due_date: e.target.value })} /></div>
              <div className="col-span-4"><Label>{t("common.reference")}</Label><Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} /></div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t("invoices.lines")}</Label>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, { description: "", account_id: "", quantity: 1, unit_price: 0, tax_id: "", tax_rate: 15 }])}>
                  <Plus className="h-3 w-3 me-1" />{t("common.add")}
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-start p-2">{t("common.description")}</th>
                      <th className="text-start p-2 w-44">{t("je.account")}</th>
                      <th className="text-end p-2 w-20">{t("invoices.qty")}</th>
                      <th className="text-end p-2 w-28">{t("invoices.price")}</th>
                      <th className="text-start p-2 w-32">{t("nav.taxes")}</th>
                      <th className="text-end p-2 w-28 font-mono">{t("common.total")}</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const sub = l.quantity * l.unit_price;
                      const lineTotal = sub * (1 + l.tax_rate / 100);
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-1"><Input value={l.description} onChange={(e) => { const n = [...lines]; n[i] = { ...l, description: e.target.value }; setLines(n); }} className="h-8 text-xs" /></td>
                          <td className="p-1">
                            <Select value={l.account_id} onValueChange={(v) => { const n = [...lines]; n[i] = { ...l, account_id: v }; setLines(n); }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {expenseAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {localized(a, "name")}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1"><Input type="number" value={l.quantity} onChange={(e) => { const n = [...lines]; n[i] = { ...l, quantity: Number(e.target.value) }; setLines(n); }} className="h-8 text-xs text-end font-mono" /></td>
                          <td className="p-1"><Input type="number" value={l.unit_price} onChange={(e) => { const n = [...lines]; n[i] = { ...l, unit_price: Number(e.target.value) }; setLines(n); }} className="h-8 text-xs text-end font-mono" /></td>
                          <td className="p-1">
                            <Select value={l.tax_id} onValueChange={(v) => {
                              const tax = purchaseTaxes.find((tx: any) => tx.id === v);
                              const n = [...lines]; n[i] = { ...l, tax_id: v, tax_rate: tax ? Number(tax.rate) : 0 }; setLines(n);
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— {t("invoices.noTax")} —</SelectItem>
                                {purchaseTaxes.map((tx: any) => <SelectItem key={tx.id} value={tx.id}>{tx.code} ({tx.rate}%)</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-end font-mono">{fmt(lineTotal)}</td>
                          <td className="p-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}><Trash2 className="h-3 w-3" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 font-mono">
                    <tr className="border-t"><td colSpan={5} className="p-2 text-end font-medium">{t("invoices.subtotal")}</td><td className="p-2 text-end">{fmt(totals.subtotal)}</td><td></td></tr>
                    <tr><td colSpan={5} className="p-2 text-end font-medium">{t("invoices.vat")}</td><td className="p-2 text-end">{fmt(totals.taxAmt)}</td><td></td></tr>
                    <tr className="border-t"><td colSpan={5} className="p-2 text-end font-bold">{t("common.total")}</td><td className="p-2 text-end font-bold text-base">{fmt(totals.total)}</td><td></td></tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="secondary" onClick={() => createMut.mutate("draft")} disabled={createMut.isPending || !canSave}>{t("je.saveDraft")}</Button>
              <Button onClick={() => createMut.mutate("posted")} disabled={createMut.isPending || !canSave}><Check className="h-4 w-4 me-1" />{t("invoices.saveAndPost")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium font-mono">{t("invoices.number")}</th>
              <th className="text-start p-3 font-medium">{t("invoices.date")}</th>
              <th className="text-start p-3 font-medium">{t("invoices.vendor")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("common.total")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("invoices.paid")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("invoices.due")}</th>
              <th className="text-start p-3 font-medium">{t("common.status")}</th>
              <th className="text-center p-3 font-medium">{t("approvals.approval")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{inv.invoice_number}</td>
                <td className="p-3">{inv.invoice_date}</td>
                <td className="p-3 font-medium">{localized(inv.partners, "name")}</td>
                <td className="p-3 text-end font-mono">{fmt(inv.total)}</td>
                <td className="p-3 text-end font-mono text-success">{fmt(inv.amount_paid)}</td>
                <td className="p-3 text-end font-mono font-semibold">{fmt(inv.amount_due)}</td>
                <td className="p-3">{statusBadge(inv.status, t)}</td>
                <td className="p-3 text-center"><ApprovalCell documentType="invoice" documentId={inv.id} /></td>
                <td className="p-3 text-end">
                  {inv.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => postMut.mutate(inv.id)} disabled={postMut.isPending}>
                      <Check className="h-3 w-3 me-1" />{t("je.post")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
