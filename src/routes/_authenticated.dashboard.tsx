import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardKpis, listJournalEntries } from "@/lib/api/accounting.functions";
import { getUserContext } from "@/lib/api/context.functions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Plus, TrendingDown, TrendingUp, Wallet, Clock } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function fmt(n: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n);
}

function DashboardPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const { user } = useAuth();
  const fetchCtx = useServerFn(getUserContext);
  const fetchKpis = useServerFn(getDashboardKpis);
  const fetchJEs = useServerFn(listJournalEntries);

  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => fetchCtx(), enabled: !!user });
  const hasSetup = (ctx?.companies?.length ?? 0) > 0;

  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis", companyId, branchId],
    queryFn: () => fetchKpis({ data: { companyId: companyId!, branchId: branchId! } }),
    enabled: !!user && !!companyId && !!branchId,
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-je", branchId],
    queryFn: () => fetchJEs({ data: { branchId: branchId!, limit: 10 } }),
    enabled: !!user && !!branchId,
  });

  if (ctx && !hasSetup) {
    return <EmptySetup />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/journal-entries/new"><Plus className="h-4 w-4 me-1" />{t("je.new")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          label={t("dashboard.receivables")}
          value={fmt(kpis?.receivables ?? 0, locale)}
          accent="success"
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
          label={t("dashboard.payables")}
          value={fmt(kpis?.payables ?? 0, locale)}
          accent="destructive"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5 text-info" />}
          label={t("dashboard.cashPosition")}
          value={fmt(kpis?.cashPosition ?? 0, locale)}
          accent="info"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-warning" />}
          label={t("dashboard.pendingApprovals")}
          value={String(kpis?.pendingApprovals ?? 0)}
          accent="warning"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t("dashboard.recentEntries")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/journal-entries">{t("dashboard.viewAll")} <ArrowRight className="h-3 w-3 ms-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent && recent.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-2 font-medium">{t("je.entryNumber")}</th>
                    <th className="text-start p-2 font-medium">{t("je.entryDate")}</th>
                    <th className="text-start p-2 font-medium">{t("je.journal")}</th>
                    <th className="text-start p-2 font-medium">{t("common.description")}</th>
                    <th className="text-end p-2 font-medium font-mono">{t("common.amount")}</th>
                    <th className="text-center p-2 font-medium">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r: any) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 font-mono">{r.entry_number}</td>
                      <td className="p-2">{r.entry_date}</td>
                      <td className="p-2">{r.journals ? localized(r.journals, "name") : "—"}</td>
                      <td className="p-2 text-muted-foreground">{r.description || "—"}</td>
                      <td className="p-2 text-end font-mono">{fmt(Number(r.total_debit), locale)}</td>
                      <td className="p-2 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("dashboard.noActivity")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-10 w-10 rounded-lg bg-${accent}/10 flex items-center justify-center`}>{icon}</div>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const variants: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    posted: "bg-success/15 text-success border-success/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={variants[status] ?? ""}>{t(`je.${status}`)}</Badge>;
}

function EmptySetup() {
  const { t } = useI18n();
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{t("setup.title")}</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">{t("setup.subtitle")}</p>
          <Button asChild size="lg">
            <Link to="/setup">{t("setup.create")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
