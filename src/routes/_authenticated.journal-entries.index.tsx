import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJournalEntries } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/routes/_authenticated.dashboard";
import { ApprovalCell } from "@/components/approval-cell";

export const Route = createFileRoute("/_authenticated/journal-entries/")({
  component: JEListPage,
});

function JEListPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { branchId } = useBranch();
  const fn = useServerFn(listJournalEntries);
  const { data: entries = [] } = useQuery({
    queryKey: ["je-list", branchId],
    queryFn: () => fn({ data: { branchId: branchId!, limit: 200 } }),
    enabled: !!branchId,
  });

  const fmt = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 }).format(n);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("je.title")}</h1>
        <Button asChild><Link to="/journal-entries/new"><Plus className="h-4 w-4 me-1" />{t("je.new")}</Link></Button>
      </div>
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3">{t("je.entryNumber")}</th>
              <th className="text-start p-3">{t("je.entryDate")}</th>
              <th className="text-start p-3">{t("je.journal")}</th>
              <th className="text-start p-3">{t("common.description")}</th>
              <th className="text-end p-3 font-mono">{t("je.debit")}</th>
              <th className="text-end p-3 font-mono">{t("je.credit")}</th>
              <th className="text-center p-3">{t("common.status")}</th>
              <th className="text-center p-3">{t("approvals.approval")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e: any) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{e.entry_number}</td>
                <td className="p-3">{e.entry_date}</td>
                <td className="p-3">{e.journals ? localized(e.journals, "name") : "—"}</td>
                <td className="p-3 text-muted-foreground">{e.description || "—"}</td>
                <td className="p-3 text-end font-mono">{fmt(Number(e.total_debit))}</td>
                <td className="p-3 text-end font-mono">{fmt(Number(e.total_credit))}</td>
                <td className="p-3 text-center"><StatusBadge status={e.status} /></td>
                <td className="p-3 text-center"><ApprovalCell documentType="journal_entry" documentId={e.id} /></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
