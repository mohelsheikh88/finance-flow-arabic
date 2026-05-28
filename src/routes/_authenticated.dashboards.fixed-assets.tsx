import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAssets, listCategories } from "@/lib/api/assets.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Layers, TrendingDown, Plus, ArrowRight } from "lucide-react";
import { StatCard, QuickActions, SectionDashboardHeader, formatMoney } from "@/components/section-dashboard";

export const Route = createFileRoute("/_authenticated/dashboards/fixed-assets")({
  component: FixedAssetsDashboard,
});

function FixedAssetsDashboard() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();

  const fetchAssets = useServerFn(listAssets);
  const fetchCategories = useServerFn(listCategories);

  const { data: assets = [] } = useQuery({
    queryKey: ["fa-assets", companyId],
    queryFn: () => fetchAssets({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["fa-categories", companyId],
    queryFn: () => fetchCategories({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const totals = (assets as any[]).reduce(
    (acc, a) => {
      acc.cost += Number(a.acquisition_cost) || 0;
      acc.depreciated += Number(a.accumulated_depreciation) || 0;
      if (a.status === "active") acc.active += 1;
      if (a.status === "disposed") acc.disposed += 1;
      return acc;
    },
    { cost: 0, depreciated: 0, active: 0, disposed: 0 },
  );
  const nbv = totals.cost - totals.depreciated;

  // Group by category
  const byCat = new Map<string, { name: string; count: number; cost: number; nbv: number }>();
  (assets as any[]).forEach((a) => {
    const cat = (categories as any[]).find((c) => c.id === a.category_id);
    const name = cat ? (locale === "ar" ? cat.name_ar : cat.name_en) : "—";
    const key = a.category_id ?? "none";
    const existing = byCat.get(key) ?? { name, count: 0, cost: 0, nbv: 0 };
    existing.count += 1;
    existing.cost += Number(a.acquisition_cost) || 0;
    existing.nbv += (Number(a.acquisition_cost) || 0) - (Number(a.accumulated_depreciation) || 0);
    byCat.set(key, existing);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionDashboardHeader title={t("nav.fixedAssetsDashboard")} subtitle={t("nav.fixedAssets")} />
        <Button asChild>
          <Link to="/assets"><Plus className="h-4 w-4 me-1" />{t("nav.assets")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Briefcase className="h-5 w-5 text-primary" />} label={t("common.total") || "Assets"} value={(assets as any[]).length} sublabel={`${totals.active} ${t("common.active")}`} accent="primary" />
        <StatCard icon={<Briefcase className="h-5 w-5 text-info" />} label={t("common.cost") || "Acquisition cost"} value={formatMoney(totals.cost, locale)} accent="info" />
        <StatCard icon={<TrendingDown className="h-5 w-5 text-warning" />} label={t("common.depreciation") || "Accumulated depr."} value={formatMoney(totals.depreciated, locale)} accent="warning" />
        <StatCard icon={<Layers className="h-5 w-5 text-success" />} label={t("common.nbv") || "Net book value"} value={formatMoney(nbv, locale)} accent="success" />
      </div>

      <QuickActions actions={[
        { to: "/assets", label: t("nav.assets") },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t("common.byCategory") || "By category"}</h3>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-start py-1">{t("common.category") || "Category"}</th><th className="text-center py-1">#</th><th className="text-end py-1">{t("common.cost") || "Cost"}</th><th className="text-end py-1">NBV</th></tr></thead>
            <tbody>
              {Array.from(byCat.values()).map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5 text-center">{c.count}</td>
                  <td className="py-1.5 text-end">{formatMoney(c.cost, locale)}</td>
                  <td className="py-1.5 text-end font-semibold">{formatMoney(c.nbv, locale)}</td>
                </tr>
              ))}
              {byCat.size === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t("common.recent") || "Recent assets"}</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/assets">{t("common.viewAll") || "View all"} <ArrowRight className="h-3.5 w-3.5 ms-1" /></Link></Button>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-start py-1">{t("common.code")}</th><th className="text-start py-1">{t("common.name")}</th><th className="text-end py-1">{t("common.cost") || "Cost"}</th><th className="text-center py-1">{t("common.status")}</th></tr></thead>
            <tbody>
              {(assets as any[]).slice(0, 8).map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-1.5 font-mono">{a.code}</td>
                  <td className="py-1.5">{localized(a, "name")}</td>
                  <td className="py-1.5 text-end">{formatMoney(Number(a.acquisition_cost) || 0, locale)}</td>
                  <td className="py-1.5 text-center"><Badge variant="outline">{a.status}</Badge></td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
