import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, FileText, Printer, History, ChevronDown, Paperclip } from "lucide-react";
import { getInvoice } from "@/lib/api/invoices.functions";
import { useI18n, useLocalized } from "@/i18n";
import { HistoryLog } from "@/components/history-log";
import { TransactionAttachments } from "@/components/transaction-attachments";
import { ApprovalWorkflowTimeline } from "@/components/approval-workflow-timeline";
import { printTaxInvoice } from "@/components/invoice-print";
import { toast } from "sonner";

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    posted: "bg-info/10 text-info border-info/30",
    paid: "bg-success/10 text-success border-success/30",
    partially_paid: "bg-warning/10 text-warning border-warning/30",
    cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return m[s] || "";
}

export function InvoiceDetailDialog({
  invoiceId,
  onClose,
}: {
  invoiceId: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const getFn = useServerFn(getInvoice);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => getFn({ data: { id: invoiceId! } }),
    enabled: !!invoiceId,
  });

  const je = (inv as any)?.journal_entries ?? null;
  const lines: any[] = (inv as any)?.invoice_lines ?? [];
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const taxAmt = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate || 0) / 100), 0);
  const total = subtotal + taxAmt;

  const isPosted = ["posted", "paid", "partially_paid"].includes((inv as any)?.status);

  const handlePrint = async () => {
    if (!inv) return;
    if (!isPosted) {
      toast.error(t("invoices.cannotPrintBeforePost"));
      return;
    }
    try {
      await printTaxInvoice({
        invoice: inv,
        company: (inv as any).companies ?? null,
        lang: (locale as "ar" | "en") ?? "ar",
      });
    } catch (e: any) {
      toast.error(e.message || "Print failed");
    }
  };

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <FileText className="h-5 w-5 text-primary" />
            <span>{t("invoices.detailsTitle") || "تفاصيل الفاتورة"}</span>
            {inv && <span className="font-mono text-sm text-muted-foreground">{(inv as any).invoice_number}</span>}
            {inv && <Badge variant="outline" className={statusClass((inv as any).status)}>{t(`je.${(inv as any).status}` as any) || (inv as any).status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !inv ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{t("common.loading")}</div>
        ) : (
          <div className="space-y-4">
            <div className="w-full">
              <ApprovalWorkflowTimeline documentType="invoice" documentId={(inv as any).id} />
            </div>
            {je && (
              <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded p-2.5">
                <span className="text-muted-foreground">{t("invoices.linkedJE") || "القيد المرتبط"}:</span>
                <span className="font-mono font-medium">{je.entry_number}</span>
                <Badge variant="outline" className="text-[10px]">{t(`je.${je.status}` as any) || je.status}</Badge>
                <Link
                  to="/journal-entries"
                  search={{ openEntryId: je.id } as any}
                  onClick={onClose}
                  className="ms-auto inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("invoices.openJE") || "فتح القيد"}
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground mb-0.5">{t("invoices.date")}</div>
                <div className="font-medium">{(inv as any).invoice_date}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-0.5">{t("invoices.dueDate")}</div>
                <div className="font-medium">{(inv as any).due_date || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[11px] text-muted-foreground mb-0.5">
                  {(inv as any).invoice_type === "vendor_bill" || (inv as any).invoice_type === "vendor"
                    ? t("invoices.vendor")
                    : t("invoices.customer")}
                </div>
                <div className="font-medium">
                  {(inv as any).partners?.code} — {localized((inv as any).partners, "name")}
                </div>
              </div>
              {(inv as any).reference && (
                <div className="col-span-2 md:col-span-4">
                  <div className="text-[11px] text-muted-foreground mb-0.5">{t("common.reference")}</div>
                  <div className="font-medium">{(inv as any).reference}</div>
                </div>
              )}
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-2 w-8">#</th>
                    <th className="text-start p-2">{t("common.description")}</th>
                    <th className="text-start p-2">{t("je.account")}</th>
                    <th className="text-end p-2 w-16">{t("invoices.qty")}</th>
                    <th className="text-end p-2 w-24 font-mono">{t("invoices.price")}</th>
                    <th className="text-end p-2 w-20 font-mono">VAT %</th>
                    <th className="text-end p-2 w-28 font-mono">{t("common.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const sub = Number(l.quantity) * Number(l.unit_price);
                    const lt = sub * (1 + Number(l.tax_rate || 0) / 100);
                    return (
                      <tr key={l.id ?? i} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{l.description || "—"}</td>
                        <td className="p-2 text-xs">
                          {l.accounts ? `${l.accounts.code} — ${localized(l.accounts, "name")}` : "—"}
                        </td>
                        <td className="p-2 text-end font-mono">{fmt(Number(l.quantity))}</td>
                        <td className="p-2 text-end font-mono">{fmt(Number(l.unit_price))}</td>
                        <td className="p-2 text-end font-mono text-muted-foreground">{Number(l.tax_rate || 0)}%</td>
                        <td className="p-2 text-end font-mono font-medium">{fmt(lt)}</td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{t("common.noData")}</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-muted/30 font-mono">
                  <tr className="border-t">
                    <td colSpan={6} className="p-2 text-end font-medium">{t("invoices.subtotal")}</td>
                    <td className="p-2 text-end">{fmt(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="p-2 text-end font-medium">{t("invoices.vat")}</td>
                    <td className="p-2 text-end">{fmt(taxAmt)}</td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={6} className="p-2 text-end font-bold">{t("common.total")}</td>
                    <td className="p-2 text-end font-bold text-sm">{fmt(total)}</td>
                  </tr>
                  {Number((inv as any).amount_paid) > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="p-2 text-end font-medium text-success">{t("invoices.paid")}</td>
                        <td className="p-2 text-end text-success">{fmt(Number((inv as any).amount_paid))}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="p-2 text-end font-bold">{t("invoices.due")}</td>
                        <td className="p-2 text-end font-bold">{fmt(Number((inv as any).amount_due ?? (total - Number((inv as any).amount_paid))))}</td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>

            <Collapsible open={showAttachments} onOpenChange={setShowAttachments}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    {t("invoices.attachments.title") || "المرفقات"}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAttachments ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <TransactionAttachments
                  transactionType="invoice"
                  transactionId={(inv as any).id}
                  companyId={(inv as any).company_id}
                  branchId={(inv as any).branch_id}
                />
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t("invoices.viewChangeHistory")}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <HistoryLog table="invoices" recordId={(inv as any).id} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <DialogFooter className="gap-2">
          {inv && (
            <Button variant="default" onClick={handlePrint} disabled={!isPosted} title={!isPosted ? (locale === "ar" ? "متاح بعد الترحيل فقط" : "Available after posting only") : undefined}>
              <Printer className="h-4 w-4 me-1" />
              {t("invoices.printTax") || "طباعة فاتورة ضريبية"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
