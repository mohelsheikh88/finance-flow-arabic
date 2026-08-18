import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataScope } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Network, Globe2, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/medical-dashboard")({
  component: MedicalDashboardPage,
});

function MedicalDashboardPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const scope = useDataScope();
  const isCompanyWide = scope?.mode === "company";

  // Real, live proof of the scoping rule — reusing the actual branches
  // table. Once real medical tables (patients, appointments...) exist,
  // every one of their queries will apply the exact same `scope` filter.
  const { data: branchesInScope } = useQuery({
    queryKey: ["medical-dashboard-branches", scope],
    enabled: !!scope,
    queryFn: async () => {
      let q = supabase.from("branches").select("id, code, name_ar, name_en, is_main");
      q = isCompanyWide ? q.eq("company_id", (scope as any).companyId) : q.eq("id", (scope as any).branchId);
      const { data, error } = await q.order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: deptCount } = useQuery({
    queryKey: ["medical-dashboard-depts", scope],
    enabled: !!scope,
    queryFn: async () => {
      let q = supabase.from("departments").select("id", { count: "exact", head: true }).eq("company_id", (scope as any).companyId);
      if (!isCompanyWide) q = q.eq("branch_id", (scope as any).branchId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("nav.medicalDashboard")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("common.chooseModuleToStart")}</p>
        </div>
        <Badge
          variant="outline"
          className={
            "gap-1.5 px-3 py-1.5 text-[13px] " +
            (isCompanyWide ? "border-primary/40 text-primary bg-primary/5" : "")
          }
        >
          {isCompanyWide ? <Globe2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          {isCompanyWide ? t("common.headOfficeConsolidatedView") : t("common.branchOnlyView")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{branchesInScope?.length ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{t("common.branchesInScope")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Network className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{deptCount ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{t("nav.departments")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">{t("common.branchesInScope")}</h2>
          <div className="space-y-1.5">
            {(branchesInScope ?? []).map((b: any) => (
              <div key={b.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30 transition-colors text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1">{localized(b, "name")}</span>
                <span className="text-xs text-muted-foreground font-mono">{b.code}</span>
                {b.is_main && <Badge variant="secondary" className="text-[10px]">★ {t("common.headOffice")}</Badge>}
              </div>
            ))}
            {(!branchesInScope || branchesInScope.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">{t("common.noData")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {isCompanyWide
          ? t("common.headOfficeExplainer")
          : t("common.branchOnlyExplainer")}
      </p>
    </div>
  );
}
