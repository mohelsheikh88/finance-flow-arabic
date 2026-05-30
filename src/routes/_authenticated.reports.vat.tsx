import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVatReport } from "@/lib/api/vat.functions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, TrendingDown, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/vat")({
  component: VatPage,
});

function todayMonthRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function VatPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const { user } = useAuth();
  const get = useServerFn(getVatReport);
  const init = todayMonthRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["vat", companyId, dateFrom, dateTo],
    queryFn: () => get({ data: { companyId: companyId!, dateFrom, dateTo } }),
    enabled: !!user && !!companyId,
  });

  const netVat = data ? data.output.vat - data.input.vat : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            <FileText className="h-6 w-6 text-primary" /> {t("vat.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("vat.subtitle")}</p>
        </div>
        <Badge variant="outline" className="bg-primary/5 border-primary/30">ZATCA 15%</Badge>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">{t("vat.dateFrom")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">{t("vat.dateTo")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>{t("vat.generate")}</Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">{t("vat.outputVat")}</div>
              <div className="text-2xl font-bold font-mono">{fmt(data?.output.vat ?? 0)}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{t("vat.base")}: {fmt(data?.output.base ?? 0)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-warning" /></div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">{t("vat.inputVat")}</div>
              <div className="text-2xl font-bold font-mono">{fmt(data?.input.vat ?? 0)}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{t("vat.base")}: {fmt(data?.input.base ?? 0)}</div>
            </div>
          </div>
        </Card>
        <Card className={`p-4 border-2 ${netVat >= 0 ? "border-primary/50 bg-primary/5" : "border-info/50 bg-info/5"}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Scale className="h-5 w-5 text-primary" /></div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">{t("vat.netVat")}</div>
              <div className="text-2xl font-bold font-mono">{fmt(Math.abs(netVat))}</div>
              <div className="text-[10px] font-medium">{netVat >= 0 ? t("vat.payable") : t("vat.refundable")}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-3 border-b bg-muted/30 text-sm font-semibold">{t("vat.breakdown")}</div>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("vat.taxType")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("vat.rate")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("vat.base")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("vat.vatAmount")}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.breakdown ?? []).map((b) => (
              <tr key={b.tax_id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{b.code}</td>
                <td className="p-3 font-medium">{localized(b, "name")}</td>
                <td className="p-3">
                  <Badge variant="outline" className={b.type === "sale" ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>
                    {b.type === "sale" ? t("vat.sale") : t("vat.purchase")}
                  </Badge>
                </td>
                <td className="p-3 text-end font-mono">{b.rate}%</td>
                <td className="p-3 text-end font-mono">{fmt(b.base)}</td>
                <td className="p-3 text-end font-mono font-semibold">{fmt(b.vat)}</td>
              </tr>
            ))}
            {(!data || data.breakdown.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
