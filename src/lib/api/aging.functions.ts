import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";
import { z } from "zod";

const Input = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  asOfDate: z.string(),
  type: z.enum(["receivable", "payable"]),
});

export const getAgingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const invoiceType = data.type === "receivable" ? "customer_invoice" : "vendor_bill";

    let q = supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, total, amount_paid, amount_due, partner_id, currency_code, partners(name_ar, name_en)")
      .eq("company_id", data.companyId)
      .eq("invoice_type", invoiceType as any)
      .eq("status", "posted")
      .gt("amount_due", 0)
      .lte("invoice_date", data.asOfDate);

    if (data.branchId) q = q.eq("branch_id", data.branchId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const asOf = new Date(data.asOfDate);
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    const byPartner = new Map<string, {
      partner_id: string;
      partner_name_ar: string;
      partner_name_en: string;
      current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number;
      total: number;
    }>();

    for (const r of rows || []) {
      const due = r.due_date ? new Date(r.due_date) : new Date(r.invoice_date);
      const daysOverdue = Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / 86400000));
      const amt = Number(r.amount_due) || 0;

      let bucket: keyof typeof buckets = "current";
      if (daysOverdue === 0) bucket = "current";
      else if (daysOverdue <= 30) bucket = "d1_30";
      else if (daysOverdue <= 60) bucket = "d31_60";
      else if (daysOverdue <= 90) bucket = "d61_90";
      else bucket = "d90_plus";

      buckets[bucket] += amt;

      const p = r.partners as any;
      const existing = byPartner.get(r.partner_id) || {
        partner_id: r.partner_id,
        partner_name_ar: p?.name_ar || "—",
        partner_name_en: p?.name_en || "—",
        current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0,
      };
      existing[bucket] += amt;
      existing.total += amt;
      byPartner.set(r.partner_id, existing);
    }

    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    return {
      asOfDate: data.asOfDate,
      type: data.type,
      buckets: { ...buckets, total },
      partners: Array.from(byPartner.values()).sort((a, b) => b.total - a.total),
    };
  });
