import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgingReport } from "@/lib/api/aging.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/aging")({
  component: AgingPage,
});

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function AgingPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const run = useServerFn(getAgingReport);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"receivable" | "payable">("receivable");

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["aging", companyId, branchId, asOfDate, type],
    queryFn: () => run({ data: { companyId: companyId!, branchId, asOfDate, type } }),
    enabled: !!companyId,
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">{t("nav.aging")}</h1>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label className="text-xs">{t("aging.type")}</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receivable">{t("aging.receivable")}</SelectItem>
              <SelectItem value="payable">{t("aging.payable")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("tb.asOf")}</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <Button onClick={() => refetch()} disabled={isFetching || !companyId}>
          {isFetching ? t("common.loading") : t("vat.generate")}
        </Button>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {([
              ["current", t("aging.current")],
              ["d1_30", "1-30"],
              ["d31_60", "31-60"],
              ["d61_90", "61-90"],
              ["d90_plus", "90+"],
              ["total", t("common.total")],
            ] as const).map(([k, label]) => (
              <Card key={k} className={`p-3 ${k === "total" ? "bg-primary/5 border-primary/40" : ""}`}>
                <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
                <div className="text-sm font-mono font-bold tabular-nums">{fmt((data.buckets as any)[k] || 0)}</div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-start px-3 py-2">{t("aging.partner")}</th>
                    <th className="text-end px-3 py-2">{t("aging.current")}</th>
                    <th className="text-end px-3 py-2">1-30</th>
                    <th className="text-end px-3 py-2">31-60</th>
                    <th className="text-end px-3 py-2">61-90</th>
                    <th className="text-end px-3 py-2">90+</th>
                    <th className="text-end px-3 py-2 font-bold">{t("common.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partners.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.noData")}</td></tr>
                  ) : data.partners.map((p) => (
                    <tr key={p.partner_id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">{localized(p, "partner_name")}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(p.current)}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(p.d1_30)}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(p.d31_60)}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(p.d61_90)}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums text-destructive">{fmt(p.d90_plus)}</td>
                      <td className="px-3 py-2 text-end font-mono tabular-nums font-bold">{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
