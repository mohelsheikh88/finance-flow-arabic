import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCategorySpendReport } from "@/lib/api/purchase.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/components/section-dashboard";
import { BarChart3, ArrowLeft, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/reports/purchase-category-spend")({
  component: Page,
});

const PALETTE = [
  "hsl(206 64% 42%)", "hsl(193 66% 48%)", "hsl(25 85% 55%)", "hsl(152 60% 42%)",
  "hsl(319 40% 50%)", "hsl(35 90% 55%)", "hsl(172 40% 42%)", "hsl(354 60% 55%)",
];

function Page() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const fetchReport = useServerFn(getCategorySpendReport);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["category_spend_report", companyId, dateFrom, dateTo],
    queryFn: () => fetchReport({ data: { companyId: companyId!, dateFrom: dateFrom || null, dateTo: dateTo || null } }),
    enabled: !!companyId,
  });

  const grandTotal = (rows as any[]).reduce((s, r) => s + r.total_spend, 0);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboards/purchase"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseReports")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("purchase.reportCategorySpend")}</h1>
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

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">{t("purchase.chartSpendByCategory")}</h3>
        {(rows as any[]).length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows as any[]} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(206 20% 90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString()} />
                <YAxis type="category" dataKey={locale === "ar" ? "name_ar" : "name_en"} tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: any) => formatMoney(Number(v), locale)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total_spend" radius={[0, 6, 6, 0]}>
                  {(rows as any[]).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-2.5">{t("purchase.category")}</th>
              <th className="text-end p-2.5">{t("purchase.products")}</th>
              <th className="text-end p-2.5">{t("purchase.kpiTotalSpend")}</th>
              <th className="text-end p-2.5">{t("purchase.share") || "%"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              (rows as any[]).map((r) => (
                <tr key={r.category_id} className="border-t hover:bg-muted/30">
                  <td className="p-2.5">{localized(r, "name")}</td>
                  <td className="p-2.5 text-end">{r.product_count}</td>
                  <td className="p-2.5 text-end font-mono font-semibold">{formatMoney(r.total_spend, locale)}</td>
                  <td className="p-2.5 text-end text-muted-foreground">{r.pct}%</td>
                </tr>
              ))
            )}
          </tbody>
          {(rows as any[]).length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold bg-muted/30">
                <td className="p-2.5">{t("purchase.total")}</td>
                <td className="p-2.5"></td>
                <td className="p-2.5 text-end font-mono">{formatMoney(grandTotal, locale)}</td>
                <td className="p-2.5 text-end">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
