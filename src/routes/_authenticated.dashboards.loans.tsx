import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, Clock, Plus } from "lucide-react";
import { StatCard, QuickActions, SectionDashboardHeader, formatMoney } from "@/components/section-dashboard";

export const Route = createFileRoute("/_authenticated/dashboards/loans")({
  component: LoansDashboard,
});

function LoansDashboard() {
  const { t, locale } = useI18n();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionDashboardHeader title={t("nav.loansDashboard")} subtitle={t("nav.loansGroup")} />
        <Button asChild>
          <Link to="/loans"><Plus className="h-4 w-4 me-1" />{t("nav.loans")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CreditCard className="h-5 w-5 text-primary" />} label={t("common.activeLoans") || "Active loans"} value={0} accent="primary" />
        <StatCard icon={<Wallet className="h-5 w-5 text-info" />} label={t("common.principal") || "Outstanding principal"} value={formatMoney(0, locale)} accent="info" />
        <StatCard icon={<Clock className="h-5 w-5 text-warning" />} label={t("common.dueThisMonth") || "Due this month"} value={formatMoney(0, locale)} accent="warning" />
        <StatCard icon={<CreditCard className="h-5 w-5 text-destructive" />} label={t("common.interestYtd") || "Interest YTD"} value={formatMoney(0, locale)} accent="destructive" />
      </div>

      <QuickActions actions={[{ to: "/loans", label: t("nav.loans") }]} />

      <Card className="p-6 text-center text-muted-foreground">
        <p className="text-sm">{t("common.comingSoon") || "Loans module is coming soon."}</p>
      </Card>
    </div>
  );
}
