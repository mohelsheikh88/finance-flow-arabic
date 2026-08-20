import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRFQ, upsertRFQHeader, updateRFQStatus, saveRFQLines,
  inviteVendors, saveVendorQuote, markVendorDeclined,
  awardQuoteLines, convertRFQToPurchaseOrders,
} from "@/lib/api/rfq.functions";
import { listProducts, listUnitsOfMeasure, listWarehouses } from "@/lib/api/purchase.functions";
import { listPartners } from "@/lib/api/accounting.functions";
import { listPaymentTerms } from "@/lib/api/payment-terms.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, X, Users, Trophy, FileCheck, Send, Award, PackageCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rfqs/$rfqId")({
  component: RFQDetailPage,
});

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/10 text-info border-info/30",
  quotes_received: "bg-warning/10 text-warning border-warning/30",
  awarded: "bg-primary/10 text-primary border-primary/30",
  converted: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function RFQDetailPage() {
  const { rfqId } = Route.useParams();
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchRFQ = useServerFn(getRFQ);
  const saveHeader = useServerFn(upsertRFQHeader);
  const setStatus = useServerFn(updateRFQStatus);
  const saveLines = useServerFn(saveRFQLines);
  const invite = useServerFn(inviteVendors);
  const saveQuote = useServerFn(saveVendorQuote);
  const declineVendor = useServerFn(markVendorDeclined);
  const award = useServerFn(awardQuoteLines);
  const convert = useServerFn(convertRFQToPurchaseOrders);

  const listProductsFn = useServerFn(listProducts);
  const listUomFn = useServerFn(listUnitsOfMeasure);
  const listWhFn = useServerFn(listWarehouses);
  const listPartnersFn = useServerFn(listPartners);
  const listTermsFn = useServerFn(listPaymentTerms);

  const { data, isLoading } = useQuery({
    queryKey: ["rfq_detail", rfqId],
    queryFn: () => fetchRFQ({ data: { id: rfqId } }),
  });
  const { data: products = [] } = useQuery({ queryKey: ["products", companyId], queryFn: () => listProductsFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: uoms = [] } = useQuery({ queryKey: ["units_of_measure", companyId], queryFn: () => listUomFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses", companyId], queryFn: () => listWhFn({ data: { companyId: companyId! } }), enabled: !!companyId });
  const { data: partners = [] } = useQuery({ queryKey: ["partners", companyId], queryFn: () => listPartnersFn({ data: { companyId: companyId! } } as any), enabled: !!companyId });
  const { data: paymentTerms = [] } = useQuery({ queryKey: ["payment_terms", companyId], queryFn: () => listTermsFn({ data: { companyId: companyId! } } as any), enabled: !!companyId });
  const vendors = (partners as any[]).filter((p) => p.is_vendor);

  const rfq = data?.rfq;
  const lines = data?.lines ?? [];
  const rfqVendors = data?.vendors ?? [];
  const quoteLines = data?.quoteLines ?? [];

  const statusLabel = (s: string) => t(`rfq.status.${s}`) || s;

  // ===================== Header edit =====================
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerForm, setHeaderForm] = useState({ title: "", request_date: "", needed_by_date: "", warehouse_id: null as string | null, notes: "" });
  useEffect(() => {
    if (rfq) setHeaderForm({
      title: rfq.title, request_date: rfq.request_date, needed_by_date: rfq.needed_by_date ?? "",
      warehouse_id: rfq.warehouse_id, notes: rfq.notes ?? "",
    });
  }, [rfq]);

  const saveHeaderMut = useMutation({
    mutationFn: () => saveHeader({
      data: {
        id: rfqId, company_id: companyId!, title: headerForm.title.trim(),
        request_date: headerForm.request_date, needed_by_date: headerForm.needed_by_date || null,
        warehouse_id: headerForm.warehouse_id, notes: headerForm.notes || null,
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); setHeaderOpen(false); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => setStatus({ data: { id: rfqId, status: status as any } }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ===================== Lines =====================
  type LineRow = { id?: string; product_id: string | null; description: string; quantity: string; uom_id: string | null; target_price: string; notes: string };
  const [lineRows, setLineRows] = useState<LineRow[] | null>(null);
  const effectiveLines: LineRow[] = lineRows ?? lines.map((l: any) => ({
    id: l.id, product_id: l.product_id, description: l.description ?? "", quantity: String(l.quantity),
    uom_id: l.uom_id, target_price: l.target_price != null ? String(l.target_price) : "", notes: l.notes ?? "",
  }));
  const linesList = effectiveLines.length ? effectiveLines : [{ product_id: null, description: "", quantity: "1", uom_id: null, target_price: "", notes: "" }];

  const saveLinesMut = useMutation({
    mutationFn: () => saveLines({
      data: {
        rfqId,
        lines: linesList
          .filter((l) => l.product_id || l.description.trim())
          .map((l) => ({
            ...(l.id ? { id: l.id } : {}),
            product_id: l.product_id, description: l.description || null,
            quantity: Number(l.quantity) || 1, uom_id: l.uom_id,
            target_price: l.target_price === "" ? null : Number(l.target_price),
            notes: l.notes || null,
          })),
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); setLineRows(null); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLine = (idx: number, patch: Partial<LineRow>) => setLineRows(linesList.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const onProductPick = (idx: number, productId: string) => {
    const p = (products as any[]).find((x) => x.id === productId);
    updateLine(idx, { product_id: productId, description: p ? localized(p, "name") : "", uom_id: p?.purchase_uom_id ?? null });
  };

  // ===================== Vendors invite =====================
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pickedVendorIds, setPickedVendorIds] = useState<Set<string>>(new Set());
  useEffect(() => { setPickedVendorIds(new Set(rfqVendors.map((v: any) => v.vendor_id))); }, [rfqVendors.length]);

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { rfqId, vendorIds: [...pickedVendorIds] } }),
    onSuccess: () => { toast.success(t("common.saved")); setInviteOpen(false); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const vendorName = (vendorId: string) => {
    const v = vendors.find((x: any) => x.id === vendorId);
    return v ? localized(v, "name") : "—";
  };

  // ===================== Quote entry (per vendor) =====================
  const [quoteVendorId, setQuoteVendorId] = useState<string | null>(null);
  const activeRfqVendor = rfqVendors.find((v: any) => v.id === quoteVendorId);
  const [quoteHeader, setQuoteHeader] = useState({ quote_date: "", validity_date: "", payment_term_id: null as string | null, currency_code: "SAR", notes: "" });
  const [quoteLineValues, setQuoteLineValues] = useState<Record<string, { unit_price: string; delivery_days: string; available_qty: string }>>({});

  useEffect(() => {
    if (!activeRfqVendor) return;
    setQuoteHeader({
      quote_date: activeRfqVendor.quote_date ?? "", validity_date: activeRfqVendor.validity_date ?? "",
      payment_term_id: activeRfqVendor.payment_term_id, currency_code: activeRfqVendor.currency_code ?? "SAR",
      notes: activeRfqVendor.notes ?? "",
    });
    const vals: Record<string, any> = {};
    for (const l of lines) {
      const existing = quoteLines.find((ql: any) => ql.rfq_vendor_id === activeRfqVendor.id && ql.rfq_line_id === l.id);
      vals[l.id] = {
        unit_price: existing?.unit_price != null ? String(existing.unit_price) : "",
        delivery_days: existing?.delivery_days != null ? String(existing.delivery_days) : "",
        available_qty: existing?.available_qty != null ? String(existing.available_qty) : "",
      };
    }
    setQuoteLineValues(vals);
  }, [activeRfqVendor?.id]);

  const saveQuoteMut = useMutation({
    mutationFn: () => saveQuote({
      data: {
        rfqVendorId: quoteVendorId!,
        quote_date: quoteHeader.quote_date || null, validity_date: quoteHeader.validity_date || null,
        payment_term_id: quoteHeader.payment_term_id, currency_code: quoteHeader.currency_code,
        notes: quoteHeader.notes || null,
        lines: lines.map((l: any) => ({
          rfq_line_id: l.id,
          unit_price: quoteLineValues[l.id]?.unit_price === "" || quoteLineValues[l.id]?.unit_price === undefined ? null : Number(quoteLineValues[l.id].unit_price),
          delivery_days: quoteLineValues[l.id]?.delivery_days === "" || quoteLineValues[l.id]?.delivery_days === undefined ? null : Number(quoteLineValues[l.id].delivery_days),
          available_qty: quoteLineValues[l.id]?.available_qty === "" || quoteLineValues[l.id]?.available_qty === undefined ? null : Number(quoteLineValues[l.id].available_qty),
        })),
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); setQuoteVendorId(null); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMut = useMutation({
    mutationFn: (rfqVendorId: string) => declineVendor({ data: { rfqVendorId } }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ===================== Comparison & Award =====================
  const quotedVendors = rfqVendors.filter((v: any) => v.status === "quoted");
  const [awards, setAwards] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const initial: Record<string, string | null> = {};
    for (const l of lines) {
      const awarded = quoteLines.find((ql: any) => ql.rfq_line_id === l.id && ql.is_awarded);
      initial[l.id] = awarded ? awarded.id : null;
    }
    setAwards(initial);
  }, [lines.length, quoteLines.length]);

  const priceFor = (lineId: string, rfqVendorId: string) => quoteLines.find((ql: any) => ql.rfq_line_id === lineId && ql.rfq_vendor_id === rfqVendorId);
  const lowestPriceQuoteLineId = (lineId: string) => {
    const candidates = quotedVendors
      .map((v: any) => priceFor(lineId, v.id))
      .filter((ql: any) => ql && ql.unit_price != null);
    if (!candidates.length) return null;
    return candidates.reduce((min: any, c: any) => (c.unit_price < min.unit_price ? c : min)).id;
  };

  const awardMut = useMutation({
    mutationFn: () => award({ data: { rfqId, awards } }),
    onSuccess: () => { toast.success(t("rfq.awarded")); qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] }); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMut = useMutation({
    mutationFn: () => convert({ data: { rfqId, companyId: companyId! } }),
    onSuccess: (res: any) => {
      toast.success(`${res.count} ${t("nav.purchaseOrders")} ${t("common.new")}`);
      qc.invalidateQueries({ queryKey: ["rfq_detail", rfqId] });
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      navigate({ to: "/purchase-orders" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasAnyAward = Object.values(awards).some((v) => v);

  if (isLoading || !rfq) {
    return <div className="p-6 text-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/rfqs"><ArrowLeft className="h-4 w-4 me-1" />{t("rfq.title")}</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-mono">{rfq.rfq_number}</h1>
              <Badge variant="outline" className={STATUS_STYLES[rfq.status]}>{statusLabel(rfq.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{rfq.title}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{t("rfq.requestDate")}: {rfq.request_date}</span>
              {rfq.needed_by_date && <span>{t("rfq.neededBy")}: {rfq.needed_by_date}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHeaderOpen(true)}>{t("common.edit")}</Button>
            {rfq.status === "draft" && (
              <Button size="sm" onClick={() => statusMut.mutate("sent")}><Send className="h-4 w-4 me-1" />{t("rfq.markSent")}</Button>
            )}
            {(rfq.status === "awarded") && (
              <Button size="sm" onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                <PackageCheck className="h-4 w-4 me-1" />{t("rfq.convertToPo")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">{t("rfq.tabLines")}</TabsTrigger>
          <TabsTrigger value="vendors">{t("rfq.tabVendors")}</TabsTrigger>
          <TabsTrigger value="compare">{t("rfq.tabCompare")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("rfq.linesHint")}</p>
            <Button size="sm" variant="outline" onClick={() => setLineRows([...linesList, { product_id: null, description: "", quantity: "1", uom_id: null, target_price: "", notes: "" }])}>
              <Plus className="h-3.5 w-3.5 me-1" />{t("rfq.addLine")}
            </Button>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-start">{t("common.name")}</th>
                  <th className="p-2 text-start w-28">{t("rfq.qty")}</th>
                  <th className="p-2 text-start w-40">{t("purchase.uom")}</th>
                  <th className="p-2 text-start w-32">{t("rfq.targetPrice")}</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {linesList.map((l, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">
                      <Select value={l.product_id ?? "__none__"} onValueChange={(v) => onProductPick(idx, v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder={t("rfq.pickProductOrType")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {(products as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="mt-1" placeholder={t("rfq.freeTextDescription")} value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    </td>
                    <td className="p-2"><Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} /></td>
                    <td className="p-2">
                      <Select value={l.uom_id ?? "__none__"} onValueChange={(v) => updateLine(idx, { uom_id: v === "__none__" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {(uoms as any[]).map((u: any) => <SelectItem key={u.id} value={u.id}>{localized(u, "name")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2"><Input type="number" step="0.01" value={l.target_price} onChange={(e) => updateLine(idx, { target_price: e.target.value })} /></td>
                    <td className="p-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={linesList.length === 1} onClick={() => setLineRows(linesList.filter((_, i) => i !== idx))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex justify-end">
            <Button onClick={() => saveLinesMut.mutate()} disabled={saveLinesMut.isPending}>{t("common.save")}</Button>
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("rfq.vendorsHint")}</p>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><Users className="h-3.5 w-3.5 me-1" />{t("rfq.manageInvited")}</Button>
          </div>

          {rfqVendors.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">{t("rfq.noVendorsInvited")}</Card>
          ) : (
            <div className="space-y-2">
              {rfqVendors.map((rv: any) => (
                <Card key={rv.id} className="p-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium">{vendorName(rv.vendor_id)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={rv.status === "quoted" ? "bg-success/10 text-success border-success/30" : rv.status === "declined" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted"}
                      >
                        {t(`rfq.vendorStatus.${rv.status}`)}
                      </Badge>
                      {rv.validity_date && <span className="text-xs text-muted-foreground">{t("rfq.validUntil")}: {rv.validity_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rv.status !== "declined" && (
                      <Button size="sm" variant="outline" onClick={() => declineMut.mutate(rv.id)}>{t("rfq.markDeclined")}</Button>
                    )}
                    <Button size="sm" onClick={() => setQuoteVendorId(rv.id)}><FileCheck className="h-3.5 w-3.5 me-1" />{t("rfq.recordQuote")}</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare" className="mt-4 space-y-3">
          {quotedVendors.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">{t("rfq.noQuotesYet")}</Card>
          ) : (
            <>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-start sticky start-0 bg-muted/40">{t("common.name")}</th>
                      {quotedVendors.map((v: any) => (
                        <th key={v.id} className="p-2 text-center min-w-[140px]">{vendorName(v.vendor_id)}</th>
                      ))}
                      <th className="p-2 text-center min-w-[160px]">{t("rfq.winner")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l: any) => {
                      const bestId = lowestPriceQuoteLineId(l.id);
                      const p = (products as any[]).find((x) => x.id === l.product_id);
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="p-2 sticky start-0 bg-background">
                            <div className="font-medium">{p ? localized(p, "name") : l.description}</div>
                            <div className="text-xs text-muted-foreground">{t("rfq.qty")}: {l.quantity}</div>
                          </td>
                          {quotedVendors.map((v: any) => {
                            const ql = priceFor(l.id, v.id);
                            const isBest = ql && ql.id === bestId;
                            return (
                              <td key={v.id} className={`p-2 text-center ${isBest ? "bg-success/10" : ""}`}>
                                {ql?.unit_price != null ? (
                                  <div>
                                    <div className={`font-mono font-semibold ${isBest ? "text-success" : ""}`}>{Number(ql.unit_price).toFixed(2)}</div>
                                    {ql.delivery_days != null && <div className="text-[10px] text-muted-foreground">{ql.delivery_days} {t("rfq.days")}</div>}
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                            );
                          })}
                          <td className="p-2">
                            <Select value={awards[l.id] ?? "__none__"} onValueChange={(v) => setAwards({ ...awards, [l.id]: v === "__none__" ? null : v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">—</SelectItem>
                                {quotedVendors.map((v: any) => {
                                  const ql = priceFor(l.id, v.id);
                                  if (!ql || ql.unit_price == null) return null;
                                  return <SelectItem key={ql.id} value={ql.id}>{vendorName(v.vendor_id)} ({Number(ql.unit_price).toFixed(2)})</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              <div className="flex justify-end">
                <Button onClick={() => awardMut.mutate()} disabled={!hasAnyAward || awardMut.isPending}>
                  <Award className="h-4 w-4 me-1" />{t("rfq.awardSelected")}
                </Button>
              </div>
              {rfq.status === "awarded" && (
                <Card className="p-4 bg-primary/5 border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <p className="text-sm">{t("rfq.readyToConvert")}</p>
                  </div>
                  <Button onClick={() => convertMut.mutate()} disabled={convertMut.isPending}>
                    <PackageCheck className="h-4 w-4 me-1" />{t("rfq.convertToPo")}
                  </Button>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={headerOpen} onOpenChange={setHeaderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("rfq.rfqTitle")}</Label><Input value={headerForm.title} onChange={(e) => setHeaderForm({ ...headerForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.requestDate")}</Label><Input type="date" value={headerForm.request_date} onChange={(e) => setHeaderForm({ ...headerForm, request_date: e.target.value })} /></div>
              <div><Label>{t("rfq.neededBy")}</Label><Input type="date" value={headerForm.needed_by_date} onChange={(e) => setHeaderForm({ ...headerForm, needed_by_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>{t("purchase.deliverTo")}</Label>
              <Select value={headerForm.warehouse_id ?? "__none__"} onValueChange={(v) => setHeaderForm({ ...headerForm, warehouse_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {(warehouses as any[]).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("common.notes")}</Label><Textarea value={headerForm.notes} onChange={(e) => setHeaderForm({ ...headerForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeaderOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveHeaderMut.mutate()} disabled={saveHeaderMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("rfq.manageInvited")}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {vendors.map((v: any) => (
              <label key={v.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickedVendorIds.has(v.id)}
                  onChange={() => {
                    const next = new Set(pickedVendorIds);
                    next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                    setPickedVendorIds(next);
                  }}
                />
                <span>{v.code} — {localized(v, "name")}</span>
              </label>
            ))}
            {vendors.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t("common.noData")}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quoteVendorId} onOpenChange={(o) => !o && setQuoteVendorId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("rfq.recordQuote")} — {activeRfqVendor && vendorName(activeRfqVendor.vendor_id)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("rfq.quoteDate")}</Label><Input type="date" value={quoteHeader.quote_date} onChange={(e) => setQuoteHeader({ ...quoteHeader, quote_date: e.target.value })} /></div>
              <div><Label>{t("rfq.validUntil")}</Label><Input type="date" value={quoteHeader.validity_date} onChange={(e) => setQuoteHeader({ ...quoteHeader, validity_date: e.target.value })} /></div>
              <div>
                <Label>{t("purchase.paymentTerms")}</Label>
                <Select value={quoteHeader.payment_term_id ?? "__none__"} onValueChange={(v) => setQuoteHeader({ ...quoteHeader, payment_term_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(paymentTerms as any[]).map((pt: any) => <SelectItem key={pt.id} value={pt.id}>{localized(pt, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.currency")}</Label><Input value={quoteHeader.currency_code} onChange={(e) => setQuoteHeader({ ...quoteHeader, currency_code: e.target.value.toUpperCase() })} dir="ltr" /></div>
            </div>

            <div>
              <Label className="mb-2 block">{t("rfq.lineQuotes")}</Label>
              <div className="space-y-2">
                {lines.map((l: any) => {
                  const p = (products as any[]).find((x: any) => x.id === l.product_id);
                  const vals = quoteLineValues[l.id] ?? { unit_price: "", delivery_days: "", available_qty: "" };
                  return (
                    <Card key={l.id} className="p-2.5">
                      <p className="text-sm font-medium mb-2">{p ? localized(p, "name") : l.description} <span className="text-xs text-muted-foreground">({t("rfq.qty")}: {l.quantity})</span></p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-xs">{t("purchase.unitPrice")}</Label><Input type="number" step="0.01" value={vals.unit_price} onChange={(e) => setQuoteLineValues({ ...quoteLineValues, [l.id]: { ...vals, unit_price: e.target.value } })} /></div>
                        <div><Label className="text-xs">{t("rfq.deliveryDays")}</Label><Input type="number" value={vals.delivery_days} onChange={(e) => setQuoteLineValues({ ...quoteLineValues, [l.id]: { ...vals, delivery_days: e.target.value } })} /></div>
                        <div><Label className="text-xs">{t("rfq.availableQty")}</Label><Input type="number" step="0.01" value={vals.available_qty} onChange={(e) => setQuoteLineValues({ ...quoteLineValues, [l.id]: { ...vals, available_qty: e.target.value } })} /></div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
            <div><Label>{t("common.notes")}</Label><Textarea value={quoteHeader.notes} onChange={(e) => setQuoteHeader({ ...quoteHeader, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteVendorId(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveQuoteMut.mutate()} disabled={saveQuoteMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
