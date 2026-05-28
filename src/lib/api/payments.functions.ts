import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreatePaymentSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  partner_id: z.string().uuid(),
  payment_date: z.string(),
  amount: z.number().positive(),
  currency_code: z.string().min(3).max(3).default("SAR"),
  bank_account_id: z.string().uuid().optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  journal_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "posted"]).default("posted"),
  allocations: z.array(z.object({
    invoice_id: z.string().uuid(),
    allocated_amount: z.number().positive(),
  })).optional().default([]),
});

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { branchId: string; direction?: "inbound" | "outbound"; limit?: number }) => i)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("payments")
      .select("*, partners(code, name_ar, name_en), bank_accounts(name_ar, name_en)")
      .eq("branch_id", data.branchId)
      .order("payment_date", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.direction) q = q.eq("direction", data.direction);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listOpenInvoicesForPartner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { partnerId: string; invoiceType: "customer" | "vendor" }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, amount_paid, amount_due, status")
      .eq("partner_id", data.partnerId)
      .eq("invoice_type", data.invoiceType)
      .in("status", ["posted", "partially_paid"])
      .gt("amount_due", 0)
      .order("invoice_date");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreatePaymentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve journal: bank journal linked to bank_account, else any bank/cash journal
    let journalId = data.journal_id;
    let cashAccountId: string | null = null;
    if (data.bank_account_id) {
      const { data: bank } = await supabase
        .from("bank_accounts")
        .select("journal_id, gl_account_id")
        .eq("id", data.bank_account_id)
        .single();
      if (bank) {
        if (!journalId) journalId = bank.journal_id;
        cashAccountId = bank.gl_account_id;
      }
    }
    if (!journalId) {
      const { data: j } = await supabase
        .from("journals")
        .select("id, default_debit_account_id, default_credit_account_id")
        .eq("company_id", data.company_id)
        .in("journal_type", ["bank", "cash"])
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!j) throw new Error("No bank/cash journal configured");
      journalId = j.id;
      cashAccountId = cashAccountId || j.default_debit_account_id || j.default_credit_account_id;
    }
    if (!cashAccountId) throw new Error("No bank/cash account configured");

    // Partner control account
    const { data: partner } = await supabase
      .from("partners")
      .select("receivable_account_id, payable_account_id")
      .eq("id", data.partner_id)
      .single();
    const partnerCtrl = data.direction === "inbound"
      ? partner?.receivable_account_id
      : partner?.payable_account_id;
    if (!partnerCtrl) throw new Error("Partner has no control account configured");

    // Get sequence
    const { data: journal } = await supabase
      .from("journals")
      .select("sequence_prefix, sequence_next")
      .eq("id", journalId)
      .single();
    const prefix = journal?.sequence_prefix ?? (data.direction === "inbound" ? "RCP" : "PAY");
    const seq = journal?.sequence_next ?? 1;
    const yr = new Date(data.payment_date).getFullYear();
    const paymentNumber = `${prefix}/${yr}/${String(seq).padStart(5, "0")}`;

    const { data: pay, error: pErr } = await supabase
      .from("payments")
      .insert({
        company_id: data.company_id,
        branch_id: data.branch_id,
        direction: data.direction,
        partner_id: data.partner_id,
        payment_number: paymentNumber,
        payment_date: data.payment_date,
        amount: data.amount,
        currency_code: data.currency_code,
        bank_account_id: data.bank_account_id || null,
        journal_id: journalId,
        reference: data.reference || null,
        notes: data.notes || null,
        status: "draft",
        created_by: userId,
      })
      .select()
      .single();
    if (pErr || !pay) throw new Error(pErr?.message ?? "Failed");

    await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", journalId);

    // Allocations
    if (data.allocations.length > 0) {
      const sum = data.allocations.reduce((s, a) => s + a.allocated_amount, 0);
      if (sum > data.amount + 0.001) throw new Error("Allocations exceed payment amount");
      await supabase.from("payment_allocations").insert(
        data.allocations.map((a) => ({ payment_id: pay.id, invoice_id: a.invoice_id, allocated_amount: a.allocated_amount })),
      );
    }

    if (data.status === "posted") {
      await postPaymentInternal(supabase, userId!, pay.id, cashAccountId, partnerCtrl);
    }

    return pay;
  });

async function postPaymentInternal(supabase: any, userId: string, paymentId: string, cashAccountId: string, partnerCtrl: string) {
  const { data: pay } = await supabase
    .from("payments")
    .select("*, payment_allocations(*)")
    .eq("id", paymentId)
    .single();
  if (!pay) throw new Error("Payment not found");
  if (pay.status !== "draft") throw new Error("Already posted");

  const isInbound = pay.direction === "inbound";

  // JE: inbound (receipt) -> Dr Cash, Cr AR; outbound -> Dr AP, Cr Cash
  const jeLines = [
    {
      line_number: 1,
      account_id: cashAccountId,
      description: `Payment ${pay.payment_number}`,
      debit: isInbound ? pay.amount : 0,
      credit: isInbound ? 0 : pay.amount,
    },
    {
      line_number: 2,
      account_id: partnerCtrl,
      partner_id: pay.partner_id,
      description: `Payment ${pay.payment_number}`,
      debit: isInbound ? 0 : pay.amount,
      credit: isInbound ? pay.amount : 0,
    },
  ];

  const { data: period } = await supabase
    .from("fiscal_periods")
    .select("id, status")
    .eq("company_id", pay.company_id)
    .lte("date_from", pay.payment_date)
    .gte("date_to", pay.payment_date)
    .maybeSingle();
  if (period && period.status !== "open") throw new Error("Fiscal period closed");

  const { data: journal } = await supabase
    .from("journals")
    .select("sequence_prefix, sequence_next")
    .eq("id", pay.journal_id)
    .single();
  const prefix = journal?.sequence_prefix ?? "JV";
  const seq = journal?.sequence_next ?? 1;
  const yr = new Date(pay.payment_date).getFullYear();
  const entryNumber = `${prefix}/${yr}/${String(seq).padStart(5, "0")}`;

  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      company_id: pay.company_id,
      branch_id: pay.branch_id,
      journal_id: pay.journal_id,
      period_id: period?.id ?? null,
      entry_number: entryNumber,
      entry_date: pay.payment_date,
      reference: pay.payment_number,
      description: `${isInbound ? "Receipt" : "Payment"} ${pay.payment_number}`,
      status: "posted",
      total_debit: pay.amount,
      total_credit: pay.amount,
      source_type: "payment",
      source_id: pay.id,
      created_by: userId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed JE");

  const { error: lErr } = await supabase
    .from("journal_entry_lines")
    .insert(jeLines.map((l) => ({ ...l, entry_id: je.id })));
  if (lErr) {
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw new Error(lErr.message);
  }

  await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", pay.journal_id);

  await supabase
    .from("payments")
    .update({ status: "posted", journal_entry_id: je.id, posted_by: userId, posted_at: new Date().toISOString() })
    .eq("id", pay.id);

  // Apply allocations to invoices
  for (const a of pay.payment_allocations ?? []) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("total, amount_paid")
      .eq("id", a.invoice_id)
      .single();
    if (!inv) continue;
    const newPaid = Number(inv.amount_paid) + Number(a.allocated_amount);
    const newDue = Number(inv.total) - newPaid;
    const newStatus = newDue <= 0.001 ? "paid" : "partially_paid";
    await supabase
      .from("invoices")
      .update({ amount_paid: newPaid, amount_due: Math.max(0, newDue), status: newStatus })
      .eq("id", a.invoice_id);
  }

  return je;
}
