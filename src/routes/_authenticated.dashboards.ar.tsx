import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoices } from "@/lib/api/invoices.functions";
import { getAgingReport } from "@/lib/api/aging.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Wallet, Users, TrendingUp, Clock, AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { StatCard, QuickActions, SectionDashboardHeader, formatMoney } from "@/components/section-dashboard";

export const Route = createFileRoute("/_authenticated/dashboards/ar")({
  component: ArDashboard,
});

function ArDashboard() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();

  const fetchInvoices = useServerFn(listInvoices);
  const fetchAging = useServerFn(getAgingReport);
  const today = new Date().toISOString().slice(0, 10);

  const { data: invoices = [] } = useQuery({
    queryKey: ["ar-invoices", branchId],
    queryFn: () => fetchInvoices({ data: { branchId: branchId!, invoiceType: "customer", limit: 200 } }),
    enabled: !!branchId,
  });

  const { data: aging } = useQuery({
    queryKey: ["ar-aging", companyId, branchId, today],
    queryFn: () => fetchAging({ data: { companyId: companyId!, branchId: branchId ?? null, asOfDate: today, type: "receivable" } }),
    enabled: !!companyId,
  });

  const totals = (invoices as any[]).reduce(
    (acc, i) => {
      acc.total += Number(i.total) || 0;
      acc.paid += Number(i.amount_paid) || 0;
      acc.due += Number(i.amount_due) || 0;
      if (i.status === "draft") acc.draft += 1;
      if (i.status === "posted") acc.posted += 1;
      return acc;
    },
    { total: 0, paid: 0, due: 0, draft: 0, posted: 0 },
  );

  const recent = (invoices as any[]).slice(0, 8);
  const topDebtors = aging?.partners?.slice(0, 5) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionDashboardHeader title={t("nav.arDashboard")} subtitle={t("nav.accountsReceivable")} />
        <Button asChild>
          <Link to="/invoices/customer"><Plus className="h-4 w-4 me-1" />{t("ar.invoices")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="h-5 w-5 text-primary" />} label={t("common.total") || "Total"} value={formatMoney(totals.total, locale)} sublabel={`${invoices.length} ${t("ar.invoices")}`} accent="primary" />
        <StatCard icon={<Wallet className="h-5 w-5 text-success" />} label={t("common.paid") || "Collected"} value={formatMoney(totals.paid, locale)} accent="success" />
        <StatCard icon={<Clock className="h-5 w-5 text-warning" />} label={t("common.due") || "Outstanding"} value={formatMoney(totals.due, locale)} accent="warning" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label={t("nav.aging") || "90+ days"} value={formatMoney(aging?.buckets?.d90_plus ?? 0, locale)} accent="destructive" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {(["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const).map((k) => (
          <Card key={k} className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">{k === "current" ? "Current" : k.replace("d", "").replace("_plus", "+").replace("_", "-") + " d"}</p>
            <p className="text-lg font-bold mt-1">{formatMoney(aging?.buckets?.[k] ?? 0, locale)}</p>
          </Card>
        ))}
      </div>

      <QuickActions actions={[
        { to: "/invoices/customer", label: t("ar.invoices") },
        { to: "/credit-memos", label: t("ar.creditMemo") },
        { to: "/receipts", label: t("ar.receipts") },
        { to: "/customers", label: t("ar.customers") },
        { to: "/reports/aging", label: t("nav.aging") },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("common.recent") || "Recent invoices"}</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/invoices/customer">{t("common.viewAll") || "View all"} <ArrowRight className="h-3.5 w-3.5 ms-1" /></Link></Button>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-start py-1">#</th><th className="text-start py-1">{t("common.partner") || "Customer"}</th><th className="text-end py-1">{t("common.total")}</th><th className="text-center py-1">{t("common.status")}</th></tr></thead>
            <tbody>
              {recent.map((i: any) => (
                <tr key={i.id} className="border-t">
                  <td className="py-1.5 font-mono">{i.invoice_number}</td>
                  <td className="py-1.5">{localized(i.partners ?? {}, "name")}</td>
                  <td className="py-1.5 text-end">{formatMoney(Number(i.total) || 0, locale)}</td>
                  <td className="py-1.5 text-center"><Badge variant="outline">{i.status}</Badge></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("common.topDebtors") || "Top outstanding customers"}</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/reports/aging">{t("common.viewAll") || "View all"} <ArrowRight className="h-3.5 w-3.5 ms-1" /></Link></Button>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-start py-1">{t("common.partner") || "Customer"}</th><th className="text-end py-1">{t("common.total")}</th></tr></thead>
            <tbody>
              {topDebtors.map((p: any) => (
                <tr key={p.partner_id} className="border-t">
                  <td className="py-1.5">{locale === "ar" ? p.partner_name_ar : p.partner_name_en}</td>
                  <td className="py-1.5 text-end font-semibold">{formatMoney(p.total, locale)}</td>
                </tr>
              ))}
              {topDebtors.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
