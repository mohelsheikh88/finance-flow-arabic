import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIncomeStatement } from "@/lib/api/reports.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/income-statement")({
  component: IncomeStatementPage,
});

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayMonthRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), 0, 1);
  const fmtD = (x: Date) => x.toISOString().slice(0, 10);
  return { from: fmtD(from), to: fmtD(d) };
}

function IncomeStatementPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const get = useServerFn(getIncomeStatement);
  const init = todayMonthRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["income_stmt", companyId, dateFrom, dateTo],
    queryFn: () => get({ data: { companyId: companyId!, dateFrom, dateTo } }),
    enabled: !!companyId,
  });

  const totalIncome = data?.totals.income ?? 0;
  const totalCosts = data?.totals.costs ?? 0;
  const gross = data?.totals.grossProfit ?? 0;
  const totalExpenses = data?.totals.expenses ?? 0;
  const net = data?.totals.netIncome ?? 0;

  const renderGroups = (groups: any[], fallbackLabel: string) =>
    groups.map((g: any) => {
      const title = g.classification_id
        ? localized({ name_ar: g.name_ar, name_en: g.name_en }, "name")
        : fallbackLabel;
      return (
        <div key={g.classification_id ?? `__${g.bucket}_${g.code ?? ""}`}>
          <div className="bg-muted/30 px-3 py-2 border-t border-b font-semibold text-sm flex justify-between">
            <span>{title}</span>
            <span className="font-mono">{fmt(g.total)}</span>
          </div>
          {g.accounts.map((r: any) => (
            <div key={r.id} className="flex justify-between px-6 py-1.5 text-xs border-b border-muted/30">
              <span><span className="font-mono text-muted-foreground me-2">{r.code}</span>{localized(r, "name")}</span>
              <span className="font-mono">{fmt(r.balance)}</span>
            </div>
          ))}
        </div>
      );
    });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="page-title"><TrendingUp className="h-6 w-6 text-primary" /> {t("nav.incomeStatement")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports.isSubtitle")}</p>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div><Label className="text-xs">{t("vat.dateFrom")}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">{t("vat.dateTo")}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" /></div>
          <Button onClick={() => refetch()} disabled={isFetching}>{t("vat.generate")}</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("accounts.income")}</div>
          <div className="text-xl font-bold font-mono">{fmt(totalIncome)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("reports.totalCosts")}</div>
          <div className="text-xl font-bold font-mono">{fmt(totalCosts)}</div>
        </Card>
        <Card className={`p-4 border-2 ${gross >= 0 ? "border-primary/40 bg-primary/5" : "border-destructive/50 bg-destructive/5"}`}>
          <div className="text-xs text-muted-foreground">{t("reports.grossProfit")}</div>
          <div className="text-xl font-bold font-mono">{fmt(gross)}</div>
        </Card>
        <Card className={`p-4 border-2 ${net >= 0 ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"}`}>
          <div className="text-xs text-muted-foreground">{t("reports.netIncome")}</div>
          <div className="text-xl font-bold font-mono">{fmt(Math.abs(net))}</div>
          <div className="text-[10px] font-medium">{net >= 0 ? t("reports.profit") : t("reports.loss")}</div>
        </Card>
      </div>

      <Card>
        {/* Revenue */}
        <div className="p-3 border-b bg-success/5 font-semibold">{t("accounts.income")}</div>
        {renderGroups(data?.incomeGroups ?? [], t("accounts.income"))}
        {(data?.incomeGroups?.length ?? 0) === 0 && <div className="px-6 py-2 text-xs text-muted-foreground">—</div>}
        <div className="bg-success/10 px-3 py-2 border-t font-bold flex justify-between">
          <span>{t("reports.totalIncome")}</span>
          <span className="font-mono text-base">{fmt(totalIncome)}</span>
        </div>

        {/* Costs */}
        <div className="p-3 border-b bg-warning/5 font-semibold">{t("reports.costs")}</div>
        {renderGroups(data?.costGroups ?? [], t("reports.costs"))}
        {(data?.costGroups?.length ?? 0) === 0 && <div className="px-6 py-2 text-xs text-muted-foreground">—</div>}
        <div className="bg-warning/10 px-3 py-2 border-t font-bold flex justify-between">
          <span>{t("reports.totalCosts")}</span>
          <span className="font-mono text-base">{fmt(totalCosts)}</span>
        </div>

        {/* Gross Profit */}
        <div className={`px-3 py-3 border-t-2 font-bold flex justify-between text-base ${gross >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
          <span>{t("reports.grossProfit")}</span>
          <span className="font-mono">{fmt(gross)}</span>
        </div>

        {/* Expenses */}
        <div className="p-3 border-b bg-warning/5 font-semibold">{t("accounts.expense")}</div>
        {renderGroups(data?.expenseGroups ?? [], t("accounts.expense"))}
        {(data?.expenseGroups?.length ?? 0) === 0 && <div className="px-6 py-2 text-xs text-muted-foreground">—</div>}
        <div className="bg-warning/10 px-3 py-2 border-t font-bold flex justify-between">
          <span>{t("reports.totalExpenses")}</span>
          <span className="font-mono text-base">{fmt(totalExpenses)}</span>
        </div>

        {/* Net Income */}
        <div className={`px-3 py-3 border-t-2 font-bold flex justify-between text-lg ${net >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
          <span>{t("reports.netIncome")}</span>
          <span className="font-mono">{fmt(net)}</span>
        </div>
      </Card>
    </div>
  );
}
