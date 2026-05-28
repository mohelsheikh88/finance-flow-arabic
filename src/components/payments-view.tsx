import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPayment, listOpenInvoicesForPartner, listPayments } from "@/lib/api/payments.functions";
import { listPartners } from "@/lib/api/accounting.functions";
import { listBankAccounts } from "@/lib/api/banks.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentsView({
  initialDirection = "inbound",
  lockDirection = false,
  title,
}: {
  initialDirection?: "inbound" | "outbound";
  lockDirection?: boolean;
  title?: string;
}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listPayments);
  const create = useServerFn(createPayment);
  const openInv = useServerFn(listOpenInvoicesForPartner);
  const partFn = useServerFn(listPartners);
  const bankFn = useServerFn(listBankAccounts);

  const [dir, setDir] = useState<"inbound" | "outbound">(initialDirection);
  const [open, setOpen] = useState(false);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", branchId, dir],
    queryFn: () => list({ data: { branchId: branchId!, direction: dir } }),
    enabled: !!branchId,
  });
  const { data: partners = [] } = useQuery({ queryKey: ["partners", companyId], queryFn: () => partFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: banks = [] } = useQuery({ queryKey: ["bank_accounts", companyId], queryFn: () => bankFn({ data: { companyId: companyId! } }), enabled: !!companyId });

  const candidates = partners.filter((p: any) => dir === "inbound" ? p.is_customer : p.is_vendor);

  const [form, setForm] = useState({
    partner_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    amount: 0,
    bank_account_id: "",
    reference: "",
    notes: "",
  });
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const { data: openInvoices = [] } = useQuery({
    queryKey: ["open_invoices", form.partner_id, dir],
    queryFn: () => openInv({ data: { partnerId: form.partner_id, invoiceType: dir === "inbound" ? "customer" : "vendor" } }),
    enabled: !!form.partner_id,
  });

  const allocatedTotal = useMemo(() => Object.values(alloc).reduce((s, v) => s + (v || 0), 0), [alloc]);
  const reset = () => {
    setForm({ partner_id: "", payment_date: new Date().toISOString().slice(0, 10), amount: 0, bank_account_id: "", reference: "", notes: "" });
    setAlloc({});
  };

  const createMut = useMutation({
    mutationFn: () => create({ data: {
      company_id: companyId!,
      branch_id: branchId!,
      direction: dir,
      partner_id: form.partner_id,
      payment_date: form.payment_date,
      amount: form.amount,
      bank_account_id: form.bank_account_id || null,
      reference: form.reference || null,
      notes: form.notes || null,
      status: "posted",
      allocations: Object.entries(alloc)
        .filter(([, v]) => v && v > 0)
        .map(([invoice_id, allocated_amount]) => ({ invoice_id, allocated_amount })),
    } as any }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.partner_id && form.amount > 0 && form.bank_account_id;
  const totalIn = payments.filter((p: any) => p.status === "posted").reduce((s: number, p: any) => s + Number(p.amount), 0);

  const heading = title ?? (dir === "inbound" ? t("payments.inbound") : t("payments.outbound"));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-sm text-muted-foreground">{payments.length}</p>
        </div>
        <div className="flex gap-2">
          {!lockDirection && (
            <div className="flex rounded-md border overflow-hidden">
              <button onClick={() => setDir("inbound")} className={`px-3 py-1 text-xs font-medium flex items-center gap-1 ${dir === "inbound" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                <ArrowDownToLine className="h-3 w-3" />{t("payments.inbound")}
              </button>
              <button onClick={() => setDir("outbound")} className={`px-3 py-1 text-xs font-medium flex items-center gap-1 ${dir === "outbound" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                <ArrowUpFromLine className="h-3 w-3" />{t("payments.outbound")}
              </button>
            </div>
          )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 me-1" />{t("payments.new")}</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{dir === "inbound" ? t("payments.newReceipt") : t("payments.newPayment")}</DialogTitle></DialogHeader>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{dir === "inbound" ? t("invoices.customer") : t("invoices.vendor")} *</Label>
                  <Select value={form.partner_id} onValueChange={(v) => { setForm({ ...form, partner_id: v }); setAlloc({}); }}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {candidates.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("payments.bank")} *</Label>
                  <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code} — {localized(b, "name")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("invoices.date")} *</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
                <div><Label>{t("common.amount")} *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="font-mono text-end" /></div>
                <div className="col-span-2"><Label>{t("common.reference")}</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
              </div>

              {form.partner_id && openInvoices.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t("payments.allocateTo")}</Label>
                    <span className="text-xs font-mono">
                      {t("payments.allocated")}: {fmt(allocatedTotal)} / {fmt(form.amount)}
                    </span>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="w-8 p-2"></th>
                          <th className="text-start p-2 font-mono">{t("invoices.number")}</th>
                          <th className="text-start p-2">{t("invoices.date")}</th>
                          <th className="text-end p-2 font-mono">{t("invoices.due")}</th>
                          <th className="text-end p-2 font-mono w-32">{t("payments.allocate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openInvoices.map((inv: any) => {
                          const checked = alloc[inv.id] !== undefined;
                          return (
                            <tr key={inv.id} className="border-t">
                              <td className="p-2"><Checkbox checked={checked} onCheckedChange={(v) => {
                                const next = { ...alloc };
                                if (v) next[inv.id] = Number(inv.amount_due);
                                else delete next[inv.id];
                                setAlloc(next);
                              }} /></td>
                              <td className="p-2 font-mono">{inv.invoice_number}</td>
                              <td className="p-2">{inv.invoice_date}</td>
                              <td className="p-2 text-end font-mono">{fmt(inv.amount_due)}</td>
                              <td className="p-1">
                                <Input
                                  type="number" value={alloc[inv.id] ?? ""}
                                  onChange={(e) => setAlloc({ ...alloc, [inv.id]: Number(e.target.value) })}
                                  className="h-8 text-xs text-end font-mono"
                                  disabled={!checked}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !canSave}>{t("payments.saveAndPost")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 col-span-3">
          <div className="text-xs text-muted-foreground">{dir === "inbound" ? t("payments.totalReceived") : t("payments.totalPaid")}</div>
          <div className="text-3xl font-bold font-mono">{fmt(totalIn)} <span className="text-sm font-normal text-muted-foreground">SAR</span></div>
        </Card>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium font-mono">{t("payments.number")}</th>
              <th className="text-start p-3 font-medium">{t("invoices.date")}</th>
              <th className="text-start p-3 font-medium">{dir === "inbound" ? t("invoices.customer") : t("invoices.vendor")}</th>
              <th className="text-start p-3 font-medium">{t("payments.bank")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("common.amount")}</th>
              <th className="text-start p-3 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{p.payment_number}</td>
                <td className="p-3">{p.payment_date}</td>
                <td className="p-3 font-medium">{localized(p.partners, "name")}</td>
                <td className="p-3 text-muted-foreground">{p.bank_accounts ? localized(p.bank_accounts, "name") : "—"}</td>
                <td className="p-3 text-end font-mono font-semibold">{fmt(p.amount)}</td>
                <td className="p-3">
                  <Badge variant="outline" className={p.status === "posted" ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                    {t(`je.${p.status}`) || p.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
