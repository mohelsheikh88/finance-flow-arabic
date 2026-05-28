import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBankAccounts, getBankBalance } from "@/lib/api/banks.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Landmark, Wallet, Plus, ArrowRight } from "lucide-react";
import { StatCard, QuickActions, SectionDashboardHeader, formatMoney } from "@/components/section-dashboard";

export const Route = createFileRoute("/_authenticated/dashboards/banks")({
  component: BanksDashboard,
});

function BanksDashboard() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();

  const fetchAccounts = useServerFn(listBankAccounts);
  const fetchBalance = useServerFn(getBankBalance);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts", companyId],
    queryFn: () => fetchAccounts({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const balanceQueries = useQueries({
    queries: (accounts as any[]).map((a) => ({
      queryKey: ["bank-balance", companyId, a.gl_account_id],
      queryFn: () => fetchBalance({ data: { companyId: companyId!, glAccountId: a.gl_account_id } }),
      enabled: !!companyId && !!a.gl_account_id,
    })),
  });

  const totalBalance = balanceQueries.reduce((s, q) => s + (Number(q.data) || 0), 0);
  const totalAccounts = (accounts as any[]).length;
  const currencies = new Set((accounts as any[]).map((a) => a.currency_code).filter(Boolean));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionDashboardHeader title={t("nav.banksDashboard")} subtitle={t("nav.banksGroup")} />
        <Button asChild>
          <Link to="/banks"><Plus className="h-4 w-4 me-1" />{t("banksGroup.accounts")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Landmark className="h-5 w-5 text-primary" />} label={t("banksGroup.accounts")} value={totalAccounts} accent="primary" />
        <StatCard icon={<Wallet className="h-5 w-5 text-success" />} label={t("common.total") || "Total balance"} value={formatMoney(totalBalance, locale)} accent="success" />
        <StatCard icon={<Landmark className="h-5 w-5 text-info" />} label={t("common.currencies") || "Currencies"} value={currencies.size} accent="info" />
      </div>

      <QuickActions actions={[
        { to: "/banks", label: t("banksGroup.accounts") },
        { to: "/receipts", label: t("banksGroup.receipts") },
        { to: "/payments", label: t("banksGroup.payments") },
        { to: "/bank-expenses", label: t("banksGroup.expenses") },
        { to: "/bank-reconciliations", label: t("banksGroup.reconciliations") },
      ]} />

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t("banksGroup.accounts")}</h3>
          <Button asChild variant="ghost" size="sm"><Link to="/banks">{t("common.viewAll") || "View all"} <ArrowRight className="h-3.5 w-3.5 ms-1" /></Link></Button>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-start py-1">{t("common.code")}</th>
              <th className="text-start py-1">{t("common.name")}</th>
              <th className="text-start py-1">Bank</th>
              <th className="text-center py-1">{t("common.currency") || "Currency"}</th>
              <th className="text-end py-1">{t("common.balance") || "Balance"}</th>
            </tr>
          </thead>
          <tbody>
            {(accounts as any[]).map((a, i) => (
              <tr key={a.id} className="border-t">
                <td className="py-1.5 font-mono">{a.code}</td>
                <td className="py-1.5">{localized(a, "name")}</td>
                <td className="py-1.5">{a.bank_name}</td>
                <td className="py-1.5 text-center"><Badge variant="outline">{a.currency_code}</Badge></td>
                <td className="py-1.5 text-end font-semibold">{formatMoney(Number(balanceQueries[i]?.data) || 0, locale, a.currency_code || "SAR")}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
