import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrialBalance } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/trial-balance")({
  component: TBPage,
});

function TBPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const fn = useServerFn(getTrialBalance);
  const { data: rows = [] } = useQuery({
    queryKey: ["tb", companyId, date],
    queryFn: () => fn({ data: { companyId: companyId!, asOfDate: date } }),
    enabled: !!companyId,
  });

  const fmt = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 }).format(n);
  const totals = rows.reduce((a: any, r: any) => ({ d: a.d + r.debit, c: a.c + r.credit }), { d: 0, c: 0 });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("tb.title")}</h1>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">{t("tb.asOf")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" /></div>
        </div>
      </div>
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3">{t("common.code")}</th>
              <th className="text-start p-3">{t("tb.account")}</th>
              <th className="text-start p-3">{t("accounts.classification")}</th>
              <th className="text-end p-3 font-mono">{t("tb.periodDebit")}</th>
              <th className="text-end p-3 font-mono">{t("tb.periodCredit")}</th>
              <th className="text-end p-3 font-mono">{t("tb.closingBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const bal = r.debit - r.credit;
              const clsName = r.classification_id
                ? localized({ name_ar: r.classification_name_ar, name_en: r.classification_name_en }, "name")
                : t(`accounts.${r.bucket ?? r.type}`);
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono">{r.code}</td>
                  <td className="p-3 font-medium">{localized(r, "name")}</td>
                  <td className="p-3 text-muted-foreground">{clsName}</td>
                  <td className="p-3 text-end font-mono">{fmt(r.debit)}</td>
                  <td className="p-3 text-end font-mono">{fmt(r.credit)}</td>
                  <td className={`p-3 text-end font-mono ${bal < 0 ? "text-destructive" : ""}`}>{fmt(bal)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 font-bold">
            <tr>
              <td colSpan={3} className="p-3 text-end">{t("tb.totals")}</td>
              <td className="p-3 text-end font-mono">{fmt(totals.d)}</td>
              <td className="p-3 text-end font-mono">{fmt(totals.c)}</td>
              <td className="p-3 text-end font-mono">{fmt(totals.d - totals.c)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );

}
