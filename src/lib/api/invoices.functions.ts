import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maybeRequestApproval } from "./approvals.functions";
import { assertNotLocked } from "./lock-dates.functions";

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

    await assertNotLocked(supabase, data.company_id, data.branch_id, data.invoice_date);


    // Auto-select journal
    let journalId = data.journal_id;
    if (!journalId) {
      const wantedType = data.invoice_type === "customer" ? "sales" : "purchase";
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

    // Bump invoice journal sequence
    await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", journalId);

    // Always create the JE (as draft) so it shows in JE screen + trial balance
    await upsertInvoiceJE(supabase, inv.id, userId!, "draft");

    // Post if requested (will route via approval workflow if one matches)
    if (data.status === "posted") {
      await postInvoiceCore(context.supabase, context.userId!, inv.id);
    }

    return inv;
  });

/**
 * Build the JE lines for an invoice. Throws when control / VAT accounts
 * are not configured.
 */
async function buildInvoiceJEPayload(supabase: any, invoiceId: string) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, partners(receivable_account_id, payable_account_id, customer_type_id, customer_types(receivable_account_id)), invoice_lines(*, taxes(account_id))")
    .eq("id", invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const isCustomer = inv.invoice_type === "customer";
  const partnerCtrl = isCustomer
    ? (inv.partners?.receivable_account_id || inv.partners?.customer_types?.receivable_account_id)
    : inv.partners?.payable_account_id;
  if (!partnerCtrl) {
    throw new Error(
      isCustomer
        ? "Customer has no receivable account configured (set it on the customer or on the customer type)"
        : "Vendor has no payable account configured",
    );
  }

  const jeLines: any[] = [];
  let lineNo = 1;
  jeLines.push({
    line_number: lineNo++,
    account_id: partnerCtrl,
    partner_id: inv.partner_id,
    description: `${isCustomer ? "Invoice" : "Bill"} ${inv.invoice_number}`,
    debit: isCustomer ? inv.total : 0,
    credit: isCustomer ? 0 : inv.total,
  });
  for (const l of inv.invoice_lines) {
    jeLines.push({
      line_number: lineNo++,
      account_id: l.account_id,
      partner_id: inv.partner_id,
      cost_center_id: l.cost_center_id || null,
      description: l.description || `Line ${l.line_number}`,
      debit: isCustomer ? 0 : l.subtotal,
      credit: isCustomer ? l.subtotal : 0,
    });
    if (l.tax_amount > 0 && l.taxes?.account_id) {
      jeLines.push({
        line_number: lineNo++,
        account_id: l.taxes.account_id,
        partner_id: inv.partner_id,
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
  return { inv, isCustomer, jeLines, totalDebit, totalCredit };
}

/**
 * Create or refresh the journal entry attached to an invoice.
 * When `targetStatus="posted"` validates that the fiscal period is open.
 * Sequence is consumed only when a new JE is created.
 */
export async function upsertInvoiceJE(
  supabase: any,
  invoiceId: string,
  userId: string,
  targetStatus: "draft" | "posted",
) {
  const { inv, isCustomer, jeLines, totalDebit, totalCredit } = await buildInvoiceJEPayload(supabase, invoiceId);

  const { data: period } = await supabase
    .from("fiscal_periods")
    .select("id, status")
    .eq("company_id", inv.company_id)
    .lte("date_from", inv.invoice_date)
    .gte("date_to", inv.invoice_date)
    .maybeSingle();
  if (targetStatus === "posted" && period && period.status !== "open") {
    throw new Error("Fiscal period is closed");
  }

  const description = `${isCustomer ? "Customer Invoice" : "Vendor Bill"} ${inv.invoice_number}`;
  const postedFields = targetStatus === "posted"
    ? { posted_by: userId, posted_at: new Date().toISOString() }
    : { posted_by: null, posted_at: null };

  let jeId: string | null = inv.journal_entry_id ?? null;

  if (jeId) {
    // Refresh existing JE
    const { error: ue } = await supabase
      .from("journal_entries")
      .update({
        period_id: period?.id ?? null,
        entry_date: inv.invoice_date,
        reference: inv.invoice_number,
        description,
        status: targetStatus,
        total_debit: totalDebit,
        total_credit: totalCredit,
        ...postedFields,
      })
      .eq("id", jeId);
    if (ue) throw new Error(ue.message);
    await supabase.from("journal_entry_lines").delete().eq("entry_id", jeId);
    const { error: le } = await supabase
      .from("journal_entry_lines")
      .insert(jeLines.map((l) => ({ ...l, entry_id: jeId })));
    if (le) throw new Error(le.message);
  } else {
    // New JE — consume journal sequence
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
        description,
        status: targetStatus,
        total_debit: totalDebit,
        total_credit: totalCredit,
        source_type: "invoice",
        source_id: inv.id,
        created_by: userId,
        ...postedFields,
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
    jeId = je.id;
    await supabase.from("invoices").update({ journal_entry_id: jeId }).eq("id", inv.id);
  }

  return jeId;
}


/**
 * Core posting logic. Routes through approval workflow when one matches
 * (creates an approval_request and returns without posting). Pass
 * `bypassApproval` from the approval-handler to actually post.
 */
export async function postInvoiceCore(
  supabase: any,
  userId: string,
  invoiceId: string,
  opts: { bypassApproval?: boolean } = {},
) {
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, status, company_id, branch_id, journal_id, total, invoice_number, currency_code")
    .eq("id", invoiceId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be posted");

  // Approval gate
  if (!opts.bypassApproval) {
    const res = await maybeRequestApproval(supabase, userId, {
      companyId: inv.company_id,
      branchId: inv.branch_id,
      journalId: inv.journal_id ?? null,
      documentType: "invoice",
      documentId: inv.id,
      documentReference: inv.invoice_number,
      amount: Number(inv.total),
      currencyCode: inv.currency_code,
    });
    if (res.created) {
      return { pendingApproval: true, requestId: res.requestId };
    }
  }

  // Flip the existing draft JE (or create a fresh one) to posted
  const jeId = await upsertInvoiceJE(supabase, inv.id, userId, "posted");

  await supabase
    .from("invoices")
    .update({
      status: "posted",
      journal_entry_id: jeId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  return { id: jeId };
}


export const postInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    return postInvoiceCore(context.supabase, context.userId!, data.id);
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inv, error: ie } = await supabase
      .from("invoices")
      .select("id, status, amount_paid, company_id, branch_id, invoice_date, journal_entry_id")
      .eq("id", data.id)
      .single();
    if (ie || !inv) throw new Error(ie?.message || "Invoice not found");
    if (inv.status !== "draft") throw new Error("Only draft invoices can be deleted. Reset to draft first.");
    if (Number(inv.amount_paid || 0) > 0) throw new Error("Cannot delete: invoice has payments.");

    await assertNotLocked(supabase, inv.company_id, inv.branch_id, inv.invoice_date);

    // Remove linked draft JE (cascade clears its lines)
    if (inv.journal_entry_id) {
      await supabase.from("journal_entry_lines").delete().eq("entry_id", inv.journal_entry_id);
      await supabase.from("journal_entries").delete().eq("id", inv.journal_entry_id);
    }
    await supabase
      .from("approval_requests")
      .delete()
      .eq("document_type", "invoice")
      .eq("document_id", inv.id);

    // invoice_lines now cascade-deletes via FK
    const { error: de } = await supabase.from("invoices").delete().eq("id", inv.id);
    if (de) throw new Error(de.message);
    return { ok: true };
  });


const UpdateInvoiceSchema = z.object({
  id: z.string().uuid(),
  partner_id: z.string().uuid(),
  invoice_date: z.string(),
  due_date: z.string().optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z.array(LineSchema).min(1),
});

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateInvoiceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inv, error: ie } = await supabase
      .from("invoices")
      .select("id, status, company_id, branch_id, invoice_date")
      .eq("id", data.id)
      .single();
    if (ie || !inv) throw new Error(ie?.message || "Invoice not found");
    if (inv.status !== "draft") throw new Error("Only draft invoices can be edited");

    await assertNotLocked(supabase, inv.company_id, inv.branch_id, inv.invoice_date);
    await assertNotLocked(supabase, inv.company_id, inv.branch_id, data.invoice_date);

    let subtotal = 0, tax_amount = 0;
    const computedLines = data.lines.map((l, idx) => {
      const c = computeLine(l);
      subtotal += c.subtotal;
      tax_amount += c.tax_amount;
      return { ...l, ...c, line_number: idx + 1 };
    });
    const total = subtotal + tax_amount;

    const { error: ue } = await supabase
      .from("invoices")
      .update({
        partner_id: data.partner_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        reference: data.reference || null,
        notes: data.notes || null,
        subtotal, tax_amount, total,
        amount_due: total,
      })
      .eq("id", data.id);
    if (ue) throw new Error(ue.message);

    await supabase.from("invoice_lines").delete().eq("invoice_id", data.id);
    const lineRows = computedLines.map((l) => ({
      invoice_id: data.id,
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
    const { error: lerr } = await supabase.from("invoice_lines").insert(lineRows);
    if (lerr) throw new Error(lerr.message);

    // Refresh the linked draft JE so it stays in sync with invoice lines
    await upsertInvoiceJE(supabase, data.id, context.userId!, "draft");

    return { ok: true };
  });


/**
 * Permission: user can reset a posted invoice to draft if they are admin,
 * or if they hold a role required by any approval workflow step matching
 * this invoice's journal_type.
 */
async function canUserResetInvoice(supabase: any, userId: string, invoice: any): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (isAdmin) return true;

  if (!invoice.journal_id) return false;
  const { data: journal } = await supabase
    .from("journals")
    .select("journal_type")
    .eq("id", invoice.journal_id)
    .maybeSingle();
  if (!journal?.journal_type) return false;

  const { data: wfs } = await supabase
    .from("approval_workflows")
    .select("id, approval_steps_def(required_role)")
    .eq("company_id", invoice.company_id)
    .eq("journal_type", journal.journal_type)
    .eq("is_active", true);
  const roles = new Set<string>();
  for (const wf of wfs ?? []) {
    for (const s of (wf as any).approval_steps_def ?? []) {
      if (s.required_role) roles.add(s.required_role);
    }
  }
  if (roles.size === 0) return false;
  const { data: hasAny } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: Array.from(roles),
  });
  return !!hasAny;
}

async function isPeriodOpen(supabase: any, companyId: string, date: string): Promise<boolean> {
  const { data: period } = await supabase
    .from("fiscal_periods")
    .select("status")
    .eq("company_id", companyId)
    .lte("date_from", date)
    .gte("date_to", date)
    .maybeSingle();
  if (!period) return true; // no period defined => not blocked
  return period.status === "open";
}

export const canResetInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, status, company_id, journal_id, amount_paid, invoice_date")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) return { allowed: false, reason: "not_found" };
    if (inv.status !== "posted") return { allowed: false, reason: "not_posted" };
    if (Number(inv.amount_paid || 0) > 0) return { allowed: false, reason: "has_payments" };
    if (!(await isPeriodOpen(supabase, inv.company_id, inv.invoice_date))) {
      return { allowed: false, reason: "period_closed" };
    }
    const allowed = await canUserResetInvoice(supabase, userId!, inv);
    return { allowed, reason: allowed ? null : "no_permission" };
  });


export const resetInvoiceToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error: ie } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .single();
    if (ie || !inv) throw new Error(ie?.message || "Invoice not found");
    if (inv.status !== "posted") throw new Error("Only posted invoices can be reset to draft");
    if (Number(inv.amount_paid || 0) > 0) {
      throw new Error("Cannot reset: invoice has payments allocated. Reverse payments first.");
    }
    if (!(await isPeriodOpen(supabase, inv.company_id, inv.invoice_date))) {
      throw new Error("Cannot reset: fiscal period for the invoice date is closed.");
    }


    const allowed = await canUserResetInvoice(supabase, userId!, inv);
    if (!allowed) throw new Error("You do not have permission to reset this invoice to draft.");

    await assertNotLocked(supabase, inv.company_id, inv.branch_id, inv.invoice_date);

    // Flip JE back to draft (keep entry + lines so it still appears in TB/JE list as draft)
    if (inv.journal_entry_id) {
      const { error: jeErr } = await supabase
        .from("journal_entries")
        .update({ status: "draft", posted_by: null, posted_at: null })
        .eq("id", inv.journal_entry_id);
      if (jeErr) throw new Error(jeErr.message);
    }

    const { error: ue } = await supabase
      .from("invoices")
      .update({
        status: "draft",
        posted_by: null,
        posted_at: null,
      })
      .eq("id", inv.id);
    if (ue) throw new Error(ue.message);


    await supabase
      .from("approval_requests")
      .delete()
      .eq("document_type", "invoice")
      .eq("document_id", inv.id);

    return { ok: true };
  });
