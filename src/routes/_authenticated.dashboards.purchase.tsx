import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchaseDashboardStats } from "@/lib/api/purchase.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, FileText, Clock, Users, TrendingUp, ArrowRight, Plus,
} from "lucide-react";
import { StatCard, QuickActions, SectionDashboardHeader, formatMoney } from "@/components/section-dashboard";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboards/purchase")({
  component: PurchaseDashboard,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(206 15% 55%)",
  confirmed: "hsl(206 64% 45%)",
  partially_received: "hsl(35 90% 55%)",
  received: "hsl(152 65% 40%)",
  cancelled: "hsl(354 70% 55%)",
};
const CHART_PALETTE = [
  "hsl(206 64% 42%)", "hsl(193 66% 48%)", "hsl(25 85% 55%)", "hsl(152 60% 42%)",
  "hsl(319 40% 50%)", "hsl(35 90% 55%)", "hsl(172 40% 42%)", "hsl(354 60% 55%)",
];

function monthLabel(key: string, locale: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", year: "2-digit" });
}

function PurchaseDashboard() {
  const { t, locale } = useI18n();
  const { companyId } = useBranch();
  const fetchStats = useServerFn(getPurchaseDashboardStats);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase_dashboard", companyId],
    queryFn: () => fetchStats({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const kpis = data?.kpis;
  const statusBreakdown = data?.statusBreakdown ?? [];
  const monthlySpend = (data?.monthlySpend ?? []).map((m) => ({ ...m, label: monthLabel(m.month, locale) }));
  const topVendors = data?.topVendors ?? [];
  const categoryBreakdown = data?.categoryBreakdown ?? [];
  const recentOrders = data?.recentOrders ?? [];

  const statusLabel = (s: string) => t(`purchase.status.${s}`) || s;
  const vendorNameOf = (row: any) => (locale === "ar" ? row.vendor_name_ar : row.vendor_name_en) || "—";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionDashboardHeader title={t("purchase.dashboardTitle")} subtitle={t("nav.purchaseProcurement")} />
        <Button asChild>
          <Link to="/purchase-orders"><Plus className="h-4 w-4 me-1" />{t("purchase.newOrder")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<ShoppingBag className="h-5 w-5 text-primary" />} label={t("purchase.kpiTotalSpend")} value={formatMoney(kpis?.totalValue ?? 0, locale)} sublabel={`${kpis?.totalOrders ?? 0} ${t("nav.purchaseOrders")}`} accent="primary" />
        <StatCard icon={<FileText className="h-5 w-5 text-info" />} label={t("purchase.kpiTotalOrders")} value={kpis?.totalOrders ?? 0} accent="info" />
        <StatCard icon={<Clock className="h-5 w-5 text-warning" />} label={t("purchase.kpiDraftOrders")} value={kpis?.draftCount ?? 0} sublabel={t("purchase.kpiDraftHint")} accent="warning" />
        <StatCard icon={<Users className="h-5 w-5 text-success" />} label={t("purchase.kpiActiveVendors")} value={kpis?.activeVendors ?? 0} accent="success" />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label={t("purchase.kpiAvgOrder")} value={formatMoney(kpis?.avgOrderValue ?? 0, locale)} accent="muted" />
      </div>

      <QuickActions actions={[
        { to: "/purchase-orders", label: t("nav.purchaseOrders") },
        { to: "/product-categories", label: t("purchase.productCategories") },
        { to: "/products", label: t("purchase.products") },
        { to: "/product-types", label: t("purchase.productTypesTitle") },
        { to: "/units-of-measure", label: t("nav.unitsOfMeasure") },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">{t("purchase.chartMonthlySpend")}</h3>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySpend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(206 20% 90%)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => Math.round(Number(v)).toLocaleString()} />
                <Tooltip formatter={(v: any) => formatMoney(Number(v), locale)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="hsl(206 64% 42%)" strokeWidth={2.5} dot={{ r: 3 }} name={t("purchase.total")} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t("purchase.chartStatusBreakdown")}</h3>
          {isLoading || statusBreakdown.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {statusBreakdown.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "hsl(206 20% 60%)"} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, _n, p: any) => [`${v} — ${formatMoney(p.payload.total, locale)}`, statusLabel(p.payload.status)]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend formatter={(v: string) => statusLabel(v)} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t("purchase.chartTopVendors")}</h3>
          {topVendors.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendors} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(206 20% 90%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => Math.round(Number(v)).toLocaleString()} />
                  <YAxis type="category" dataKey={locale === "ar" ? "name_ar" : "name_en"} tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v), locale)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {topVendors.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t("purchase.chartSpendByCategory")}</h3>
          {categoryBreakdown.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="total" nameKey={locale === "ar" ? "name_ar" : "name_en"} innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatMoney(Number(v), locale)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t("purchase.recentOrders")}</h3>
          <Button asChild variant="ghost" size="sm"><Link to="/purchase-orders">{t("common.viewAll") || "View all"} <ArrowRight className="h-3.5 w-3.5 ms-1" /></Link></Button>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-start py-1.5">{t("purchase.poNumber")}</th>
              <th className="text-start py-1.5">{t("purchase.vendor")}</th>
              <th className="text-start py-1.5">{t("purchase.orderDate")}</th>
              <th className="text-end py-1.5">{t("purchase.total")}</th>
              <th className="text-center py-1.5">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="py-1.5 font-mono">{o.po_number}</td>
                <td className="py-1.5">{vendorNameOf(o)}</td>
                <td className="py-1.5 text-muted-foreground">{o.order_date}</td>
                <td className="py-1.5 text-end font-mono">{formatMoney(Number(o.total) || 0, locale, o.currency_code)}</td>
                <td className="py-1.5 text-center"><Badge variant="outline" style={{ borderColor: STATUS_COLORS[o.status], color: STATUS_COLORS[o.status] }}>{statusLabel(o.status)}</Badge></td>
              </tr>
            ))}
            {recentOrders.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
