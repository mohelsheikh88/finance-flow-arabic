import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LineSchema = z.object({
  description: z.string().max(500).optional().nullable(),
  account_id: z.string().uuid(),
  cost_center_id: z.string().uuid().optional().nullable(),
  quantity: z.number().min(0.0001),
  unit_price: z.number().min(0),
  tax_id: z.string().uuid().optional().nullable(),
  tax_rate: z.number().min(0).max(100).default(0),
});

const CreateInvoiceSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  invoice_type: z.enum(["customer", "vendor"]),
  partner_id: z.string().uuid(),
  invoice_date: z.string(),
  due_date: z.string().optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  journal_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "posted"]).default("draft"),
  lines: z.array(LineSchema).min(1),
});

function computeLine(l: z.infer<typeof LineSchema>) {
  const subtotal = l.quantity * l.unit_price;
  const tax_amount = subtotal * (l.tax_rate / 100);
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { branchId: string; invoiceType?: "customer" | "vendor"; limit?: number }) => i)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("invoices")
      .select("*, partners(code, name_ar, name_en)")
      .eq("branch_id", data.branchId)
      .order("invoice_date", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.invoiceType) q = q.eq("invoice_type", data.invoiceType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("invoices")
      .select("*, partners(code, name_ar, name_en, vat_number), invoice_lines(*, accounts(code, name_ar, name_en))")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return inv;
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateInvoiceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Auto-select journal
    let journalId = data.journal_id;
    if (!journalId) {
      const wantedType = data.invoice_type === "customer" ? "sale" : "purchase";
      const { data: j } = await supabase
        .from("journals")
        .select("id, sequence_prefix, sequence_next")
        .eq("company_id", data.company_id)
        .eq("journal_type", wantedType)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!j) throw new Error(`No ${wantedType} journal configured. Please create one.`);
      journalId = j.id;
    }

    const { data: journal } = await supabase
      .from("journals")
      .select("sequence_prefix, sequence_next")
      .eq("id", journalId)
      .single();
    const prefix = journal?.sequence_prefix ?? (data.invoice_type === "customer" ? "INV" : "BILL");
    const seq = journal?.sequence_next ?? 1;
    const yr = new Date(data.invoice_date).getFullYear();
    const invoiceNumber = `${prefix}/${yr}/${String(seq).padStart(5, "0")}`;

    // Compute totals
    let subtotal = 0, tax_amount = 0;
    const computedLines = data.lines.map((l, idx) => {
      const c = computeLine(l);
      subtotal += c.subtotal;
      tax_amount += c.tax_amount;
      return { ...l, ...c, line_number: idx + 1 };
    });
    const total = subtotal + tax_amount;

    // Insert invoice header
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .insert({
        company_id: data.company_id,
        branch_id: data.branch_id,
        invoice_type: data.invoice_type,
        partner_id: data.partner_id,
        invoice_number: invoiceNumber,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        reference: data.reference || null,
        notes: data.notes || null,
        subtotal, tax_amount, total,
        amount_due: total,
        status: "draft",
        journal_id: journalId,
        created_by: userId,
      })
      .select()
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Failed");

    // Lines
    const lineRows = computedLines.map((l) => ({
      invoice_id: inv.id,
      line_number: l.line_number,
      description: l.description || null,
      account_id: l.account_id,
      cost_center_id: l.cost_center_id || null,
      quantity: l.quantity,
      unit_price: l.unit_price,
      tax_id: l.tax_id || null,
      tax_rate: l.tax_rate,
      subtotal: l.subtotal,
      tax_amount: l.tax_amount,
      total: l.total,
    }));
    const { error: linesErr } = await supabase.from("invoice_lines").insert(lineRows);
    if (linesErr) {
      await supabase.from("invoices").delete().eq("id", inv.id);
      throw new Error(linesErr.message);
    }

    // Bump journal sequence
    await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", journalId);

    // Post if requested
    if (data.status === "posted") {
      await postInvoiceInternal(context.supabase, context.userId!, inv.id);
    }

    return inv;
  });

async function postInvoiceInternal(supabase: any, userId: string, invoiceId: string) {
  // Fetch invoice + partner + lines
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, partners(receivable_account_id, payable_account_id), invoice_lines(*, taxes(account_id))")
    .eq("id", invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be posted");

  const isCustomer = inv.invoice_type === "customer";
  const partnerCtrl = isCustomer ? inv.partners?.receivable_account_id : inv.partners?.payable_account_id;
  if (!partnerCtrl) {
    throw new Error(
      isCustomer
        ? "Customer has no receivable account configured"
        : "Vendor has no payable account configured",
    );
  }

  // Build JE lines
  const jeLines: any[] = [];
  let lineNo = 1;

  // Partner control account
  jeLines.push({
    line_number: lineNo++,
    account_id: partnerCtrl,
    partner_id: inv.partner_id,
    description: `${isCustomer ? "Invoice" : "Bill"} ${inv.invoice_number}`,
    debit: isCustomer ? inv.total : 0,
    credit: isCustomer ? 0 : inv.total,
  });

  // Revenue / Expense lines (one per invoice line)
  for (const l of inv.invoice_lines) {
    jeLines.push({
      line_number: lineNo++,
      account_id: l.account_id,
      cost_center_id: l.cost_center_id || null,
      description: l.description || `Line ${l.line_number}`,
      debit: isCustomer ? 0 : l.subtotal,
      credit: isCustomer ? l.subtotal : 0,
    });
    if (l.tax_amount > 0 && l.taxes?.account_id) {
      jeLines.push({
        line_number: lineNo++,
        account_id: l.taxes.account_id,
        tax_id: l.tax_id,
        description: `VAT ${l.tax_rate}%`,
        debit: isCustomer ? 0 : l.tax_amount,
        credit: isCustomer ? l.tax_amount : 0,
      });
    } else if (l.tax_amount > 0) {
      throw new Error("Tax line has no VAT account configured. Configure tax.account_id.");
    }
  }

  const totalDebit = jeLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = jeLines.reduce((s, l) => s + Number(l.credit || 0), 0);

  // Find period
  const { data: period } = await supabase
    .from("fiscal_periods")
    .select("id, status")
    .eq("company_id", inv.company_id)
    .lte("date_from", inv.invoice_date)
    .gte("date_to", inv.invoice_date)
    .maybeSingle();
  if (period && period.status !== "open") throw new Error("Fiscal period is closed");

  // Get journal sequence for entry
  const { data: journal } = await supabase
    .from("journals")
    .select("sequence_prefix, sequence_next")
    .eq("id", inv.journal_id)
    .single();
  const prefix = journal?.sequence_prefix ?? "JV";
  const seq = journal?.sequence_next ?? 1;
  const yr = new Date(inv.invoice_date).getFullYear();
  const entryNumber = `${prefix}/${yr}/${String(seq).padStart(5, "0")}`;

  const { data: je, error: jeErr } = await supabase
    .from("journal_entries")
    .insert({
      company_id: inv.company_id,
      branch_id: inv.branch_id,
      journal_id: inv.journal_id,
      period_id: period?.id ?? null,
      entry_number: entryNumber,
      entry_date: inv.invoice_date,
      reference: inv.invoice_number,
      description: `${isCustomer ? "Customer Invoice" : "Vendor Bill"} ${inv.invoice_number}`,
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      source_type: "invoice",
      source_id: inv.id,
      created_by: userId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed to create JE");

  const { error: lErr } = await supabase
    .from("journal_entry_lines")
    .insert(jeLines.map((l) => ({ ...l, entry_id: je.id })));
  if (lErr) {
    await supabase.from("journal_entries").delete().eq("id", je.id);
    throw new Error(lErr.message);
  }

  await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", inv.journal_id);

  await supabase
    .from("invoices")
    .update({
      status: "posted",
      journal_entry_id: je.id,
      posted_by: userId,
      posted_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  return je;
}

export const postInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    return postInvoiceInternal(context.supabase, context.userId!, data.id);
  });
