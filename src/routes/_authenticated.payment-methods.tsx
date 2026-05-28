import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPaymentMethods, createPaymentMethod, updatePaymentMethod } from "@/lib/api/payment-methods.functions";
import { listBankAccounts } from "@/lib/api/banks.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-methods")({
  component: Page,
});

const TYPES = ["cash", "bank_transfer", "check", "card", "other"] as const;
type MethodType = (typeof TYPES)[number];

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listPaymentMethods);
  const create = useServerFn(createPaymentMethod);
  const update = useServerFn(updatePaymentMethod);
  const banksFn = useServerFn(listBankAccounts);

  const { data: rows = [] } = useQuery({
    queryKey: ["payment_methods", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank_accounts", companyId],
    queryFn: () => banksFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const empty = {
    code: "",
    name_ar: "",
    name_en: "",
    method_type: "cash" as MethodType,
    bank_account_id: "" as string,
    is_inbound: true,
    is_outbound: true,
  };
  const [form, setForm] = useState(empty);

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          company_id: companyId!,
          code: form.code,
          name_ar: form.name_ar,
          name_en: form.name_en,
          method_type: form.method_type,
          bank_account_id: form.bank_account_id || null,
          is_inbound: form.is_inbound,
          is_outbound: form.is_outbound,
          is_active: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["payment_methods"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (m: any) => update({ data: { id: m.id, is_active: !m.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_methods"] }),
  });

  const canSave = form.code && form.name_ar && form.name_en;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("nav.paymentMethods")}</h1>
          <p className="text-sm text-muted-foreground">{rows.length}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-1" />{t("common.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("paymentMethods.new")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div>
                <Label>{t("paymentMethods.type")} *</Label>
                <Select value={form.method_type} onValueChange={(v) => setForm({ ...form, method_type: v as MethodType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((typ) => <SelectItem key={typ} value={typ}>{t(`paymentMethods.types.${typ}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.name")} (AR) *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.name")} (EN) *</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>{t("paymentMethods.bank")}</Label>
                <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code} — {localized(b, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_inbound} onCheckedChange={(v) => setForm({ ...form, is_inbound: v })} /><Label>{t("paymentMethods.inbound")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_outbound} onCheckedChange={(v) => setForm({ ...form, is_outbound: v })} /><Label>{t("paymentMethods.outbound")}</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => createMut.mutate()} disabled={!canSave || createMut.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium font-mono">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("paymentMethods.type")}</th>
              <th className="text-start p-3 font-medium">{t("paymentMethods.bank")}</th>
              <th className="text-center p-3 font-medium">{t("paymentMethods.inbound")}</th>
              <th className="text-center p-3 font-medium">{t("paymentMethods.outbound")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{m.code}</td>
                <td className="p-3 font-medium">{localized(m, "name")}</td>
                <td className="p-3"><Badge variant="outline">{t(`paymentMethods.types.${m.method_type}`)}</Badge></td>
                <td className="p-3 text-muted-foreground">{m.bank_accounts ? localized(m.bank_accounts, "name") : "—"}</td>
                <td className="p-3 text-center">{m.is_inbound ? "✓" : ""}</td>
                <td className="p-3 text-center">{m.is_outbound ? "✓" : ""}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleActive.mutate(m)} className="text-xs underline">
                    {m.is_active ? t("common.active") : t("common.inactive")}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
