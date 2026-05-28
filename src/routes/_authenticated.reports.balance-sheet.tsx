import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBalanceSheet } from "@/lib/api/reports.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/balance-sheet")({
  component: BalanceSheetPage,
});

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Section({ title, rows, total, localized }: { title: string; rows: any[]; total: number; localized: (o: any, p: string) => string }) {
  return (
    <div>
      <div className="bg-muted/30 px-3 py-2 border-t border-b font-semibold text-sm flex justify-between">
        <span>{title}</span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="flex justify-between px-6 py-1.5 text-xs border-b border-muted/30">
          <span><span className="font-mono text-muted-foreground me-2">{r.code}</span>{localized(r, "name")}</span>
          <span className="font-mono">{fmt(r.balance)}</span>
        </div>
      ))}
      {rows.length === 0 && <div className="px-6 py-2 text-xs text-muted-foreground">—</div>}
    </div>
  );
}

function BalanceSheetPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const get = useServerFn(getBalanceSheet);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["balance_sheet", companyId, asOfDate],
    queryFn: () => get({ data: { companyId: companyId!, asOfDate } }),
    enabled: !!companyId,
  });

  const balanced = data ? Math.abs(data.totals.assets - data.totals.equityAndLiabilities) < 0.01 : false;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Scale className="h-6 w-6 text-primary" /> {t("nav.balanceSheet")}</h1>
          <p className="text-sm text-muted-foreground">{t("reports.bsSubtitle")}</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3">
          <div><Label className="text-xs">{t("tb.asOf")}</Label><Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-9" /></div>
          <Button onClick={() => refetch()} disabled={isFetching}>{t("vat.generate")}</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="p-3 border-b bg-primary/5 font-semibold">{t("accounts.asset")}</div>
          <Section title={t("accounts.asset")} rows={data?.assets ?? []} total={data?.totals.assets ?? 0} localized={localized} />
          <div className="bg-primary/10 px-3 py-2 border-t font-bold flex justify-between">
            <span>{t("reports.totalAssets")}</span>
            <span className="font-mono text-base">{fmt(data?.totals.assets ?? 0)}</span>
          </div>
        </Card>

        <Card>
          <div className="p-3 border-b bg-primary/5 font-semibold">{t("reports.liabAndEquity")}</div>
          <Section title={t("accounts.liability")} rows={data?.liabilities ?? []} total={data?.totals.liabilities ?? 0} localized={localized} />
          <Section title={t("accounts.equity")} rows={data?.equity ?? []} total={data?.totals.equity ?? 0} localized={localized} />
          <div className="bg-muted/30 px-3 py-2 border-t border-b font-semibold text-sm flex justify-between">
            <span>{t("reports.retainedEarnings")}</span>
            <span className="font-mono">{fmt(data?.totals.retainedEarnings ?? 0)}</span>
          </div>
          <div className="bg-primary/10 px-3 py-2 border-t font-bold flex justify-between">
            <span>{t("reports.totalLiabEquity")}</span>
            <span className="font-mono text-base">{fmt(data?.totals.equityAndLiabilities ?? 0)}</span>
          </div>
        </Card>
      </div>

      {data && (
        <Card className={`p-3 text-sm font-medium text-center ${balanced ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
          {balanced ? `✓ ${t("reports.balanced")}` : `✗ ${t("reports.notBalanced")} — Δ ${fmt(data.totals.assets - data.totals.equityAndLiabilities)}`}
        </Card>
      )}
    </div>
  );
}
