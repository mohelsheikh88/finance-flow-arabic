import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveSummary } from "@/lib/api/reports.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, Wallet, TrendingUp, Scale, Gauge, ArrowDownToLine, ArrowUpFromLine, CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/executive-summary")({
  component: ExecSummaryPage,
});

function ytdRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), 0, 1);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return { from: f(from), to: f(d) };
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${(n * 100).toFixed(1)}%`;
const fmtRatio = (n: number | null | undefined) =>
  n == null ? "—" : n.toFixed(2);
const fmtDays = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n)}`;

function Kpi({
  label, value, sub, tone = "default", icon,
}: {
  label: string; value: string; sub?: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success" ? "border-success/40 bg-success/5"
    : tone === "warning" ? "border-warning/40 bg-warning/5"
    : tone === "danger" ? "border-destructive/40 bg-destructive/5"
    : tone === "primary" ? "border-primary/40 bg-primary/5"
    : "";
  return (
    <Card className={`p-4 border ${toneClass}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="text-2xl font-bold font-mono mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </Card>
  );
}

function ExecSummaryPage() {
  const { t } = useI18n();
  const { companyId } = useBranch();
  const init = ytdRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const get = useServerFn(getExecutiveSummary);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["exec_summary", companyId, dateFrom, dateTo],
    queryFn: () => get({ data: { companyId: companyId!, dateFrom, dateTo } }),
    enabled: !!companyId,
  });

  const cash = data?.cash;
  const p = data?.profitability;
  const pos = data?.position;
  const perf = data?.performance;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="page-title"><Activity className="h-6 w-6 text-primary" /> {t("nav.executiveSummary")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports.execSubtitle")}</p>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div><Label className="text-xs">{t("vat.dateFrom")}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">{t("vat.dateTo")}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" /></div>
          <Button onClick={() => refetch()} disabled={isFetching}>{t("vat.generate")}</Button>
          {data && <div className="text-xs text-muted-foreground ms-auto">{data.days} {t("reports.days")}</div>}
        </div>
      </Card>

      {/* Cash Position */}
      <Section title={t("reports.cashPosition")} icon={<Wallet className="h-4 w-4" />}>
        <Kpi label={t("reports.cashPosition")} value={fmt(cash?.position)} tone={(cash?.position ?? 0) >= 0 ? "success" : "danger"} icon={<Wallet className="h-4 w-4" />} />
        <Kpi label={t("reports.receivables")} value={fmt(cash?.ar)} icon={<ArrowDownToLine className="h-4 w-4" />} />
        <Kpi label={t("reports.payables")} value={fmt(cash?.ap)} icon={<ArrowUpFromLine className="h-4 w-4" />} />
        <Kpi label={t("reports.shortTermForecast")} value={fmt(perf?.shortTermForecast)} tone={(perf?.shortTermForecast ?? 0) >= 0 ? "primary" : "warning"} icon={<CalendarClock className="h-4 w-4" />} sub={`+${fmt(perf?.forecastInflow30)} / -${fmt(perf?.forecastOutflow30)}`} />
      </Section>

      {/* Profitability */}
      <Section title={t("reports.profitability")} icon={<TrendingUp className="h-4 w-4" />}>
        <Kpi label={t("reports.revenue")} value={fmt(p?.revenue)} />
        <Kpi label={t("reports.totalCosts")} value={fmt(p?.costs)} />
        <Kpi label={t("reports.grossProfit")} value={fmt(p?.grossProfit)} tone={(p?.grossProfit ?? 0) >= 0 ? "success" : "danger"} />
        <Kpi label={t("reports.grossMargin")} value={fmtPct(p?.grossMargin)} tone="primary" />
        <Kpi label={t("reports.totalExpenses")} value={fmt(p?.expenses)} />
        <Kpi label={t("reports.netIncome")} value={fmt(p?.netIncome)} tone={(p?.netIncome ?? 0) >= 0 ? "success" : "danger"} />
        <Kpi label={t("reports.netMargin")} value={fmtPct(p?.netMargin)} tone="primary" />
        <Kpi label={t("reports.returnOnAssets")} value={fmtPct(perf?.returnOnAssets)} />
      </Section>

      {/* Position */}
      <Section title={t("reports.position")} icon={<Scale className="h-4 w-4" />}>
        <Kpi label={t("reports.totalAssets")} value={fmt(pos?.totalAssets)} />
        <Kpi label="Total Liabilities" value={fmt(pos?.totalLiabilities)} />
        <Kpi label={t("reports.currentAssets")} value={fmt(pos?.currentAssets)} />
        <Kpi label={t("reports.currentLiabilities")} value={fmt(pos?.currentLiabilities)} />
        <Kpi label={t("reports.workingCapital")} value={fmt(pos?.workingCapital)} tone={(pos?.workingCapital ?? 0) >= 0 ? "success" : "danger"} />
        <Kpi label={t("reports.currentRatio")} value={fmtRatio(pos?.currentRatio)} tone={(pos?.currentRatio ?? 0) >= 1 ? "success" : "warning"} />
        <Kpi label={t("reports.quickRatio")} value={fmtRatio(pos?.quickRatio)} />
        <Kpi label={t("reports.debtToAssets")} value={fmtPct(pos?.debtToAssets)} />
      </Section>

      {/* Performance */}
      <Section title={t("reports.performance")} icon={<Gauge className="h-4 w-4" />}>
        <Kpi label={t("reports.dso")} value={fmtDays(perf?.dso)} sub={t("reports.days")} />
        <Kpi label={t("reports.dpo")} value={fmtDays(perf?.dpo)} sub={t("reports.days")} />
        <Kpi label={t("reports.forecastInflow")} value={fmt(perf?.forecastInflow30)} tone="success" />
        <Kpi label={t("reports.forecastOutflow")} value={fmt(perf?.forecastOutflow30)} tone="warning" />
      </Section>
    </div>
  );
}
