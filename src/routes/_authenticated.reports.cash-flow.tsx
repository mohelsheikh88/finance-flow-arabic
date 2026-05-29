import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCashFlowStatement } from "@/lib/api/reports.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/cash-flow")({
  component: CashFlowPage,
});

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ytdRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), 0, 1);
  const fmtD = (x: Date) => x.toISOString().slice(0, 10);
  return { from: fmtD(from), to: fmtD(d) };
}

function Section({
  title,
  lines,
  total,
  localized,
  emptyLabel,
}: {
  title: string;
  lines: any[];
  total: number;
  localized: (o: any, p: string) => string;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="bg-muted/40 px-3 py-2 border-t border-b font-semibold text-sm">{title}</div>
      {lines.length === 0 ? (
        <div className="px-6 py-2 text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        lines.map((l, idx) => (
          <div key={idx} className="flex justify-between px-6 py-1.5 text-xs border-b border-muted/30">
            <span>{localized(l, "name")}</span>
            <span className={`font-mono ${l.net >= 0 ? "text-success" : "text-destructive"}`}>{fmt(l.net)}</span>
          </div>
        ))
      )}
      <div className="bg-primary/10 px-3 py-2 border-t font-bold flex justify-between text-sm">
        <span>{title}</span>
        <span className={`font-mono ${total >= 0 ? "text-success" : "text-destructive"}`}>{fmt(total)}</span>
      </div>
    </div>
  );
}

function CashFlowPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const get = useServerFn(getCashFlowStatement);
  const init = ytdRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["cash_flow", companyId, dateFrom, dateTo],
    queryFn: () => get({ data: { companyId: companyId!, dateFrom, dateTo } }),
    enabled: !!companyId,
  });

  const net = data?.totals.netChange ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="page-title"><Wallet className="h-6 w-6 text-primary" /> {t("nav.cashFlow")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports.cfSubtitle")}</p>
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
          <div className="text-xs text-muted-foreground">{t("reports.openingCash")}</div>
          <div className="text-xl font-bold font-mono">{fmt(data?.openingCash ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-success" />
            <div className="text-xs text-muted-foreground">{t("reports.netChange")}</div>
          </div>
          <div className={`text-xl font-bold font-mono ${net >= 0 ? "text-success" : "text-destructive"}`}>{fmt(net)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("reports.closingCash")}</div>
          <div className="text-xl font-bold font-mono">{fmt(data?.closingCash ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-warning" />
            <div className="text-xs text-muted-foreground">{t("reports.cashAccounts")}</div>
          </div>
          <div className="text-xl font-bold font-mono">{data?.cashAccounts?.length ?? 0}</div>
        </Card>
      </div>

      <Card>
        <Section
          title={t("reports.cfOperating")}
          lines={data?.sections.operating ?? []}
          total={data?.totals.operating ?? 0}
          localized={localized}
          emptyLabel={t("reports.noActivity")}
        />
        <Section
          title={t("reports.cfInvesting")}
          lines={data?.sections.investing ?? []}
          total={data?.totals.investing ?? 0}
          localized={localized}
          emptyLabel={t("reports.noActivity")}
        />
        <Section
          title={t("reports.cfFinancing")}
          lines={data?.sections.financing ?? []}
          total={data?.totals.financing ?? 0}
          localized={localized}
          emptyLabel={t("reports.noActivity")}
        />

        <div className="bg-muted/40 px-3 py-2 border-t flex justify-between text-sm">
          <span>{t("reports.openingCash")}</span>
          <span className="font-mono">{fmt(data?.openingCash ?? 0)}</span>
        </div>
        <div className={`px-3 py-3 border-t-2 font-bold flex justify-between text-lg ${net >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
          <span>{t("reports.netChange")}</span>
          <span className="font-mono">{fmt(net)}</span>
        </div>
        <div className="bg-primary/15 px-3 py-3 border-t-2 font-bold flex justify-between text-lg">
          <span>{t("reports.closingCash")}</span>
          <span className="font-mono">{fmt(data?.closingCash ?? 0)}</span>
        </div>
      </Card>
    </div>
  );
}
