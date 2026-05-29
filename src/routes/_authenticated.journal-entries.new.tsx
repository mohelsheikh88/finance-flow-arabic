import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createJournalEntry, listAccounts, listJournals, listPartners } from "@/lib/api/accounting.functions";
import { getUserContext } from "@/lib/api/context.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { formatLockError } from "@/lib/lock-error";

import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/journal-entries/new")({
  component: NewJEPage,
});

type Line = { account_id: string; partner_id?: string; description: string; debit: number; credit: number };

function NewJEPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const accountsFn = useServerFn(listAccounts);
  const journalsFn = useServerFn(listJournals);
  const partnersFn = useServerFn(listPartners);
  const createFn = useServerFn(createJournalEntry);

  const accountsQ = useQuery({ queryKey: ["accounts", companyId], queryFn: () => accountsFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const journalsQ = useQuery({ queryKey: ["journals", companyId], queryFn: () => journalsFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const partnersQ = useQuery({ queryKey: ["partners", companyId], queryFn: () => partnersFn({ data: { companyId: companyId! } }), enabled: !!companyId });

  const accounts = accountsQ.data ?? [];
  const allJournals = journalsQ.data ?? [];
  const partners = partnersQ.data ?? [];

  const availableJournals = allJournals.filter((j: any) => j.allow_manual_entries === true);
  const unavailableJournals = allJournals.filter((j: any) => j.allow_manual_entries !== true);

  const ctxData = qc.getQueryData<any>(["user-context"]);
  const accountingRoles = ["admin", "finance_manager", "accounting_manager", "chief_accountant", "accountant"];
  const userRoles = (ctxData?.roles ?? []) as string[];
  const canCreateManual = userRoles.some((r) => accountingRoles.includes(r));

  const postableAccounts = accounts.filter((a: any) => !a.is_group);

  const [header, setHeader] = useState({
    journal_id: "",
    entry_date: new Date().toISOString().slice(0, 10),
    reference: "",
    description: "",
  });
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", description: "", debit: 0, credit: 0 },
    { account_id: "", description: "", debit: 0, credit: 0 },
  ]);

  const totals = useMemo(() => ({
    debit: lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    credit: lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
  }), [lines]);
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;

  const updLine = (i: number, patch: Partial<Line>) => {
    setLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const submit = useMutation({
    mutationFn: (status: "draft" | "posted") =>
      createFn({
        data: {
          company_id: companyId!,
          branch_id: branchId!,
          journal_id: header.journal_id,
          entry_date: header.entry_date,
          reference: header.reference || null,
          description: header.description || null,
          status,
          lines: lines
            .filter((l) => l.account_id)
            .map((l) => ({
              account_id: l.account_id,
              partner_id: l.partner_id || null,
              description: l.description || null,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            })),
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries();
      navigate({ to: "/journal-entries" });
    },
    onError: (e: Error) => {
      const msg = e?.message ?? "";
      if (msg.startsWith("NOT_AUTHORIZED_MANUAL_JE")) return toast.error(t("jeErrors.notAuthorized"));
      if (msg.startsWith("JOURNAL_NOT_FOUND")) return toast.error(t("jeErrors.journalNotFound"));
      if (msg.startsWith("MANUAL_NOT_ALLOWED")) {
        const j = journals.find((x: any) => x.id === header.journal_id);
        const label = j ? `${j.code} — ${localized(j, "name")}` : "";
        return toast.error(t("jeErrors.manualNotAllowed", { journal: label }));
      }
      toast.error(formatLockError(e, t));
    },

  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("je.new")}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={balanced ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
            {balanced ? t("je.balanced") : t("je.unbalanced")}
          </Badge>
          <Button variant="outline" onClick={() => submit.mutate("draft")} disabled={submit.isPending || !header.journal_id}>
            <Save className="h-4 w-4 me-1" /> {t("je.saveDraft")}
          </Button>
          <Button onClick={() => submit.mutate("posted")} disabled={submit.isPending || !balanced || !header.journal_id}>
            <Check className="h-4 w-4 me-1" /> {t("je.post")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>{t("je.journal")}</Label>
            <Select value={header.journal_id} onValueChange={(v) => setHeader({ ...header, journal_id: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder={t("je.journal")} /></SelectTrigger>
              <SelectContent>
                {journals.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.code} — {localized(j, "name")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("je.entryDate")}</Label><Input type="date" value={header.entry_date} onChange={(e) => setHeader({ ...header, entry_date: e.target.value })} className="h-9" /></div>
          <div><Label>{t("common.reference")}</Label><Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} className="h-9" /></div>
          <div className="md:col-span-4"><Label>{t("common.description")}</Label><Textarea rows={2} value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("je.lines")}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start p-2 w-12">#</th>
                <th className="text-start p-2">{t("je.account")}</th>
                <th className="text-start p-2">{t("je.partner")}</th>
                <th className="text-start p-2">{t("common.description")}</th>
                <th className="text-end p-2 font-mono w-32">{t("je.debit")}</th>
                <th className="text-end p-2 font-mono w-32">{t("je.credit")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1 text-center text-muted-foreground">{i + 1}</td>
                  <td className="p-1">
                    <Select value={l.account_id} onValueChange={(v) => updLine(i, { account_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("je.account")} /></SelectTrigger>
                      <SelectContent>
                        {postableAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {localized(a, "name")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1">
                    <Select value={l.partner_id ?? ""} onValueChange={(v) => updLine(i, { partner_id: v || undefined })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1"><Input value={l.description} onChange={(e) => updLine(i, { description: e.target.value })} className="h-8 text-xs" /></td>
                  <td className="p-1"><Input type="number" step="0.01" value={l.debit || ""} onChange={(e) => updLine(i, { debit: Number(e.target.value), credit: 0 })} className="h-8 text-xs text-end font-mono" dir="ltr" /></td>
                  <td className="p-1"><Input type="number" step="0.01" value={l.credit || ""} onChange={(e) => updLine(i, { credit: Number(e.target.value), debit: 0 })} className="h-8 text-xs text-end font-mono" dir="ltr" /></td>
                  <td className="p-1 text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((arr) => arr.filter((_, idx) => idx !== i))} disabled={lines.length <= 2}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 border-t-2">
              <tr>
                <td colSpan={4} className="p-2 text-end font-medium">{t("common.total")}</td>
                <td className="p-2 text-end font-mono font-bold">{totals.debit.toFixed(2)}</td>
                <td className="p-2 text-end font-mono font-bold">{totals.credit.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setLines((arr) => [...arr, { account_id: "", description: "", debit: 0, credit: 0 }])}>
            <Plus className="h-4 w-4 me-1" /> {t("je.addLine")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
