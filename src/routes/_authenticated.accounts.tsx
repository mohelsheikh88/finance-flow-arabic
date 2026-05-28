import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const fetchFn = useServerFn(listAccounts);
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => fetchFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const typeColors: Record<string, string> = {
    asset: "bg-info/10 text-info border-info/30",
    liability: "bg-warning/10 text-warning border-warning/30",
    equity: "bg-primary/10 text-primary border-primary/30",
    income: "bg-success/10 text-success border-success/30",
    expense: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t("accounts.title")}</h1>
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.type")}</th>
              <th className="text-center p-3 font-medium">{t("accounts.isGroup")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a: any) => {
              const depth = (a.code.match(/^\d+/)?.[0]?.length ?? 1) - 1;
              return (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono" style={{ paddingInlineStart: `${12 + depth * 16}px` }}>{a.code}</td>
                  <td className="p-3 font-medium">{localized(a, "name")}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={typeColors[a.account_type]}>
                      {t(`accounts.${a.account_type}`)}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">{a.is_group ? "✓" : ""}</td>
                  <td className="p-3 text-center">{a.is_active ? t("common.active") : t("common.inactive")}</td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
