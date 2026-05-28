import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createBankAccount, getBankBalance, listBankAccounts } from "@/lib/api/banks.functions";
import { listAccounts, listJournals } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Landmark } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/banks")({
  component: BanksPage,
});

function BanksPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();
  const listBanks = useServerFn(listBankAccounts);
  const listAcc = useServerFn(listAccounts);
  const listJ = useServerFn(listJournals);
  const getBal = useServerFn(getBankBalance);
  const create = useServerFn(createBankAccount);
  const [open, setOpen] = useState(false);

  const { data: banks = [] } = useQuery({
    queryKey: ["bank_accounts", companyId],
    queryFn: () => listBanks({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => listAcc({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: journals = [] } = useQuery({
    queryKey: ["journals", companyId],
    queryFn: () => listJ({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const balances = useQueries({
    queries: banks.map((b: any) => ({
      queryKey: ["bank_balance", b.id, b.gl_account_id],
      queryFn: () => b.gl_account_id ? getBal({ data: { companyId: companyId!, glAccountId: b.gl_account_id } }) : Promise.resolve(0),
      enabled: !!companyId,
    })),
  });

  const bankJournals = journals.filter((j: any) => j.journal_type === "bank" || j.journal_type === "cash");
  const cashAccounts = accounts.filter((a: any) => a.account_type === "asset" && !a.is_group);

  const totalBalance = balances.reduce((s, q) => s + (Number(q.data) || 0), 0);

  const [form, setForm] = useState({
    code: "", name_ar: "", name_en: "", bank_name: "",
    account_number: "", iban: "", swift_code: "", currency_code: "SAR",
    gl_account_id: "", journal_id: "",
  });

  const mut = useMutation({
    mutationFn: () => create({ data: {
      ...form,
      company_id: companyId!,
      branch_id: branchId || null,
      gl_account_id: form.gl_account_id || null,
      journal_id: form.journal_id || null,
    } as any }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      setOpen(false);
      setForm({ code: "", name_ar: "", name_en: "", bank_name: "", account_number: "", iban: "", swift_code: "", currency_code: "SAR", gl_account_id: "", journal_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("banks.title")}</h1>
          <p className="text-sm text-muted-foreground">{banks.length}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-1" />{t("common.add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("banks.title")} — {t("common.add")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>{t("banks.bankName")} *</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
              <div><Label>{t("banks.accountNumber")}</Label><Input dir="ltr" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
              <div><Label>{t("banks.iban")}</Label><Input dir="ltr" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
              <div><Label>{t("banks.swift")}</Label><Input dir="ltr" value={form.swift_code} onChange={(e) => setForm({ ...form, swift_code: e.target.value })} /></div>
              <div><Label>{t("common.currency")}</Label><Input dir="ltr" value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} maxLength={3} /></div>
              <div>
                <Label>{t("banks.glAccount")}</Label>
                <Select value={form.gl_account_id} onValueChange={(v) => setForm({ ...form, gl_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {cashAccounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {localized(a, "name")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("banks.journal")}</Label>
                <Select value={form.journal_id} onValueChange={(v) => setForm({ ...form, journal_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {bankJournals.map((j: any) => (
                      <SelectItem key={j.id} value={j.id}>{j.code} — {localized(j, "name")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.code || !form.name_ar || !form.name_en || !form.bank_name}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Landmark className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-xs text-muted-foreground">{t("banks.title")}</div>
              <div className="text-2xl font-bold font-mono">{banks.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2">
          <div className="text-xs text-muted-foreground">{t("banks.currentBalance")}</div>
          <div className="text-3xl font-bold font-mono">{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-muted-foreground">SAR</span></div>
        </Card>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("banks.bankName")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium font-mono">{t("banks.accountNumber")}</th>
              <th className="text-start p-3 font-medium font-mono">{t("banks.iban")}</th>
              <th className="text-start p-3 font-medium">{t("common.currency")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("banks.currentBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b: any, i: number) => (
              <tr key={b.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{b.code}</td>
                <td className="p-3 font-medium">{b.bank_name}</td>
                <td className="p-3">{localized(b, "name")}</td>
                <td className="p-3 font-mono text-muted-foreground">{b.account_number || "—"}</td>
                <td className="p-3 font-mono text-muted-foreground">{b.iban || "—"}</td>
                <td className="p-3 font-mono">{b.currency_code}</td>
                <td className="p-3 text-end font-mono font-semibold">
                  {(Number(balances[i]?.data) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {banks.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
