import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchaseOrderReport } from "@/lib/api/purchase.functions";
import { listPartners } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/components/section-dashboard";
import { FileText, ArrowLeft, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/purchase-orders")({
  component: Page,
});

const STATUSES = ["draft", "confirmed", "partially_received", "received", "cancelled"] as const;

function Page() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const fetchReport = useServerFn(getPurchaseOrderReport);
  const fetchPartners = useServerFn(listPartners);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendorId, setVendorId] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("__all__");

  const { data: partners = [] } = useQuery({
    queryKey: ["partners_for_report", companyId],
    queryFn: () => fetchPartners({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const vendors = (partners as any[]).filter((p) => p.is_vendor);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase_order_report", companyId, dateFrom, dateTo, vendorId, status],
    queryFn: () => fetchReport({
      data: {
        companyId: companyId!,
        dateFrom: dateFrom || null, dateTo: dateTo || null,
        vendorId: vendorId === "__all__" ? null : vendorId,
        status: status === "__all__" ? null : status,
      },
    }),
    enabled: !!companyId,
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const statusLabel = (s: string) => t(`purchase.status.${s}`) || s;
  const vendorName = (r: any) => (locale === "ar" ? r.vendor_name_ar : r.vendor_name_en) || "—";

  const clearFilters = () => { setDateFrom(""); setDateTo(""); setVendorId("__all__"); setStatus("__all__"); };
  const hasFilters = dateFrom || dateTo || vendorId !== "__all__" || status !== "__all__";

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboards/purchase"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseReports")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("purchase.reportOrders")}</h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div><Label className="text-xs">{t("common.from") || "From"}</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{t("common.to") || "To"}</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">{t("purchase.vendor")}</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.all") || "All"}</SelectItem>
                {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.code} — {localized(v, "name")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("common.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.all") || "All"}</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}><X className="h-3.5 w-3.5 me-1" />{t("common.clear") || "Clear"}</Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("common.count") || "Count"}</p><p className="text-lg font-bold">{data?.count ?? 0}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.subtotal")}</p><p className="text-lg font-bold font-mono">{formatMoney(totals?.subtotal ?? 0, locale)}</p></Card>
        <Card className="p-3 text-center"><p className="text-xs text-muted-foreground">{t("purchase.total")}</p><p className="text-lg font-bold font-mono">{formatMoney(totals?.total ?? 0, locale)}</p></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-2.5">{t("purchase.poNumber")}</th>
              <th className="text-start p-2.5">{t("purchase.vendor")}</th>
              <th className="text-start p-2.5">{t("purchase.orderDate")}</th>
              <th className="text-end p-2.5">{t("purchase.subtotal")}</th>
              <th className="text-end p-2.5">{t("purchase.taxTotal")}</th>
              <th className="text-end p-2.5">{t("purchase.total")}</th>
              <th className="text-center p-2.5">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              rows.map((o: any) => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  <td className="p-2.5 font-mono">{o.po_number}</td>
                  <td className="p-2.5">{vendorName(o)}</td>
                  <td className="p-2.5 text-muted-foreground">{o.order_date}</td>
                  <td className="p-2.5 text-end font-mono">{formatMoney(Number(o.subtotal) || 0, locale, o.currency_code)}</td>
                  <td className="p-2.5 text-end font-mono">{formatMoney(Number(o.tax_total) || 0, locale, o.currency_code)}</td>
                  <td className="p-2.5 text-end font-mono font-semibold">{formatMoney(Number(o.total) || 0, locale, o.currency_code)}</td>
                  <td className="p-2.5 text-center"><Badge variant="outline">{statusLabel(o.status)}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
