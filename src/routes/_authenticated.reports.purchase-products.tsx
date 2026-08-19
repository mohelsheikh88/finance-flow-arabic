import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProductSpendReport } from "@/lib/api/purchase.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/components/section-dashboard";
import { Tags, ArrowLeft, X, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/purchase-products")({
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const fetchReport = useServerFn(getProductSpendReport);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product_spend_report", companyId, dateFrom, dateTo],
    queryFn: () => fetchReport({ data: { companyId: companyId!, dateFrom: dateFrom || null, dateTo: dateTo || null } }),
    enabled: !!companyId,
  });

  const filtered = (rows as any[]).filter((r) =>
    !q || r.code.toLowerCase().includes(q.toLowerCase()) || localized(r, "name").toLowerCase().includes(q.toLowerCase())
  );
  const grandTotal = filtered.reduce((s, r) => s + r.total_spend, 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboards/purchase"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseReports")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Tags className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("purchase.reportProductSpend")}</h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div><Label className="text-xs">{t("common.from") || "From"}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{t("common.to") || "To"}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div className="relative sm:col-span-2">
            <Label className="text-xs">{t("common.search")}</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-8" />
            </div>
          </div>
          {(dateFrom || dateTo || q) && (
            <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setQ(""); }}><X className="h-3.5 w-3.5 me-1" />{t("common.clear") || "Clear"}</Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.products")}</p><p className="text-lg font-bold">{filtered.length}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.kpiTotalSpend")}</p><p className="text-lg font-bold font-mono">{formatMoney(grandTotal, locale)}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-2.5">{t("common.code")}</th>
              <th className="text-start p-2.5">{t("common.name")}</th>
              <th className="text-end p-2.5">{t("purchase.qty")}</th>
              <th className="text-end p-2.5">{t("purchase.unitPrice")} ({t("common.avg") || "avg"})</th>
              <th className="text-end p-2.5">{t("purchase.kpiTotalSpend")}</th>
              <th className="text-end p-2.5">{t("common.count") || "Orders"}</th>
              <th className="text-start p-2.5">{t("purchase.lastOrder") || "Last Purchase"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.product_id} className="border-t hover:bg-muted/30">
                  <td className="p-2.5 font-mono">{r.code}</td>
                  <td className="p-2.5">{localized(r, "name")}</td>
                  <td className="p-2.5 text-end font-mono">{r.total_qty}</td>
                  <td className="p-2.5 text-end font-mono">{formatMoney(r.avg_unit_price, locale)}</td>
                  <td className="p-2.5 text-end font-mono font-semibold">{formatMoney(r.total_spend, locale)}</td>
                  <td className="p-2.5 text-end">{r.order_count}</td>
                  <td className="p-2.5 text-muted-foreground">{r.last_purchase}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
