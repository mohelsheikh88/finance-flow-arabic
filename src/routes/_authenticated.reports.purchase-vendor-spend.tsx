import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVendorSpendReport } from "@/lib/api/purchase.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/components/section-dashboard";
import { Users, ArrowLeft, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/purchase-vendor-spend")({
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const { companyId } = useBranch();
  const fetchReport = useServerFn(getVendorSpendReport);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor_spend_report", companyId, dateFrom, dateTo],
    queryFn: () => fetchReport({ data: { companyId: companyId!, dateFrom: dateFrom || null, dateTo: dateTo || null } }),
    enabled: !!companyId,
  });

  const vendorName = (r: any) => (locale === "ar" ? r.vendor_name_ar : r.vendor_name_en) || "—";
  const grandTotal = (rows as any[]).reduce((s, r) => s + r.total_spend, 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboards/purchase"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseReports")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("purchase.reportVendorSpend")}</h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div><Label className="text-xs">{t("common.from") || "From"}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{t("common.to") || "To"}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          {(dateFrom || dateTo) && (
            <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}><X className="h-3.5 w-3.5 me-1" />{t("common.clear") || "Clear"}</Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.kpiActiveVendors")}</p><p className="text-lg font-bold">{(rows as any[]).length}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.kpiTotalSpend")}</p><p className="text-lg font-bold font-mono">{formatMoney(grandTotal, locale)}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-2.5">{t("common.code")}</th>
              <th className="text-start p-2.5">{t("purchase.vendor")}</th>
              <th className="text-end p-2.5">{t("common.count") || "Orders"}</th>
              <th className="text-end p-2.5">{t("purchase.kpiAvgOrder")}</th>
              <th className="text-end p-2.5">{t("purchase.kpiTotalSpend")}</th>
              <th className="text-end p-2.5">{t("purchase.share") || "%"}</th>
              <th className="text-start p-2.5">{t("purchase.lastOrder") || "Last Order"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              (rows as any[]).map((r) => (
                <tr key={r.vendor_id} className="border-t hover:bg-muted/30">
                  <td className="p-2.5 font-mono">{r.vendor_code}</td>
                  <td className="p-2.5">{vendorName(r)}</td>
                  <td className="p-2.5 text-end">{r.order_count}{r.cancelled_count > 0 && <span className="text-muted-foreground"> ({r.cancelled_count} {t("purchase.status.cancelled")})</span>}</td>
                  <td className="p-2.5 text-end font-mono">{formatMoney(r.avg_order, locale)}</td>
                  <td className="p-2.5 text-end font-mono font-semibold">{formatMoney(r.total_spend, locale)}</td>
                  <td className="p-2.5 text-end text-muted-foreground">{grandTotal ? ((r.total_spend / grandTotal) * 100).toFixed(1) : "0.0"}%</td>
                  <td className="p-2.5 text-muted-foreground">{r.last_order}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
