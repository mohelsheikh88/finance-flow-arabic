import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertNotLocked } from "./lock-dates.functions";

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("accounts")
      .select("*")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

// ---------------- Account Types (customizable per company) ----------------

export const listAccountTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("account_types")
      .select("*")
      .eq("company_id", data.companyId)
      .order("classification")
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const AccountTypeUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  classification: z.enum(ACCOUNT_TYPES),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof AccountTypeUpsertSchema>) => AccountTypeUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      classification: data.classification,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("account_types").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("account_types").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("accounts").select("id", { count: "exact", head: true }).eq("account_type_id", data.id);
    if ((count ?? 0) > 0) throw new Error("This type is used by accounts and cannot be deleted | هذا النوع مستخدم في حسابات ولا يمكن حذفه");

    const { error } = await context.supabase.from("account_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------------- Classifications (core, customizable per company) ----------------

const STATEMENTS = ["balance_sheet", "income_statement"] as const;
const NORMAL_BALANCES = ["debit", "credit"] as const;

export const listClassifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("classifications" as any)
      .select("*")
      .eq("company_id", data.companyId)
      .order("statement")
      .order("code");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

const ClassificationUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  statement: z.enum(STATEMENTS),
  normal_balance: z.enum(NORMAL_BALANCES),
  bucket: z.enum(ACCOUNT_TYPES),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof ClassificationUpsertSchema>) => ClassificationUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      statement: data.statement,
      normal_balance: data.normal_balance,
      bucket: data.bucket,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await (context.supabase as any)
        .from("classifications").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await (context.supabase as any)
      .from("classifications").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await (context.supabase as any)
      .from("account_types").select("id", { count: "exact", head: true }).eq("classification_id", data.id);
    if ((count ?? 0) > 0) throw new Error("هذا التصنيف مرتبط بأنواع حسابات ولا يمكن حذفه");
    const { error } = await (context.supabase as any).from("classifications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// ---------------- Accounts ----------------

const AccountUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  account_type_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  currency_code: z.string().trim().min(1).max(10).nullable().optional(),
  is_group: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_reconcilable: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof AccountUpsertSchema>) => AccountUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Resolve classification from selected account type (DB trigger will also sync it)
    const { data: at, error: atErr } = await context.supabase
      .from("account_types").select("classification").eq("id", data.account_type_id).single();
    if (atErr || !at) throw new Error("Invalid account type");
    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      account_type: at.classification,
      account_type_id: data.account_type_id,
      parent_id: data.parent_id ?? null,
      currency_code: data.currency_code || null,
      is_group: data.is_group ?? false,
      is_active: data.is_active ?? true,
      is_reconcilable: data.is_reconcilable ?? false,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("accounts").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("accounts").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });


export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Block delete if account is used in journal lines or as a child parent
    const [{ count: linesCount }, { count: childCount }] = await Promise.all([
      context.supabase.from("journal_entry_lines").select("id", { count: "exact", head: true }).eq("account_id", data.id),
      context.supabase.from("accounts").select("id", { count: "exact", head: true }).eq("parent_id", data.id),
    ]);
    if ((linesCount ?? 0) > 0) throw new Error("Account is used in journal entries and cannot be deleted");
    if ((childCount ?? 0) > 0) throw new Error("Account has child accounts and cannot be deleted");
    const { error } = await context.supabase.from("accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ImportRowSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  account_type: z.enum(ACCOUNT_TYPES),
  parent_code: z.string().trim().max(50).optional().nullable(),
  currency_code: z.string().trim().max(10).optional().nullable(),
  is_group: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_reconcilable: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const importAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; rows: z.infer<typeof ImportRowSchema>[] }) =>
    z.object({
      companyId: z.string().uuid(),
      rows: z.array(ImportRowSchema).min(1).max(2000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: exErr } = await context.supabase
      .from("accounts").select("id, code").eq("company_id", data.companyId);
    if (exErr) throw new Error(exErr.message);
    const codeToId = new Map<string, string>();
    (existing ?? []).forEach((r: any) => codeToId.set(r.code, r.id));

    // Sort: parents (no parent_code) first so parent_id can resolve
    const sorted = [...data.rows].sort((a, b) =>
      (a.parent_code ? 1 : 0) - (b.parent_code ? 1 : 0) || a.code.localeCompare(b.code),
    );

    let created = 0, updated = 0;
    const errors: { code: string; error: string }[] = [];

    for (const r of sorted) {
      const parent_id = r.parent_code ? (codeToId.get(r.parent_code) ?? null) : null;
      if (r.parent_code && !parent_id) {
        errors.push({ code: r.code, error: `Parent code "${r.parent_code}" not found` });
        continue;
      }
      const payload: any = {
        company_id: data.companyId,
        code: r.code,
        name_ar: r.name_ar,
        name_en: r.name_en,
        account_type: r.account_type,
        parent_id,
        currency_code: r.currency_code || null,
        is_group: r.is_group ?? false,
        is_active: r.is_active ?? true,
        is_reconcilable: r.is_reconcilable ?? false,
        notes: r.notes || null,
      };
      const existingId = codeToId.get(r.code);
      if (existingId) {
        const { error } = await context.supabase.from("accounts").update(payload).eq("id", existingId);
        if (error) { errors.push({ code: r.code, error: error.message }); continue; }
        updated++;
      } else {
        const { data: ins, error } = await context.supabase.from("accounts").insert(payload).select("id, code").single();
        if (error) { errors.push({ code: r.code, error: error.message }); continue; }
        codeToId.set(ins.code, ins.id);
        created++;
      }
    }
    return { created, updated, errors };
  });



export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("partners")
      .select("*")
      .eq("company_id", data.companyId)
      .order("name_en");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreatePartnerSchema = z.object({
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  is_customer: z.boolean(),
  is_vendor: z.boolean(),
  vat_number: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  address_ar: z.string().max(500).optional().nullable(),
  credit_limit: z.number().min(0).default(0),
  receivable_account_id: z.string().uuid().optional().nullable(),
  payable_account_id: z.string().uuid().optional().nullable(),
});

export const createPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreatePartnerSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (!data.is_customer && !data.is_vendor) {
      throw new Error("Partner must be at least a customer or a vendor");
    }
    const { data: row, error } = await context.supabase.from("partners").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listJournals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("journals")
      .select("*")
      .eq("company_id", data.companyId)
      .eq("is_active", true)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listJournalEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { branchId: string; limit?: number }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("journal_entries")
      .select("*, journals(code, name_ar, name_en)")
      .eq("branch_id", data.branchId)
      .order("entry_date", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const JELineSchema = z.object({
  account_id: z.string().uuid(),
  partner_id: z.string().uuid().optional().nullable(),
  cost_center_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  debit: z.number().min(0),
  credit: z.number().min(0),
});

const CreateJESchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  journal_id: z.string().uuid(),
  entry_date: z.string(),
  reference: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "posted"]).default("draft"),
  lines: z.array(JELineSchema).min(2),
});

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateJESchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertNotLocked(context.supabase, data.company_id, data.branch_id, data.entry_date);

    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Entry not balanced: D=${totalDebit} C=${totalCredit}`);
    }
    for (const l of data.lines) {
      if (l.debit > 0 && l.credit > 0) throw new Error("A line cannot have both debit and credit");
      if (l.debit === 0 && l.credit === 0) throw new Error("A line must have debit or credit");
    }

    // Generate entry number
    const { data: journal } = await context.supabase
      .from("journals")
      .select("sequence_prefix, sequence_next")
      .eq("id", data.journal_id)
      .single();
    const prefix = journal?.sequence_prefix ?? "JV";
    const seq = journal?.sequence_next ?? 1;
    const yr = new Date(data.entry_date).getFullYear();
    const entryNumber = `${prefix}/${yr}/${String(seq).padStart(5, "0")}`;

    // Find current fiscal period
    const { data: period } = await context.supabase
      .from("fiscal_periods")
      .select("id, status")
      .eq("company_id", data.company_id)
      .lte("date_from", data.entry_date)
      .gte("date_to", data.entry_date)
      .maybeSingle();
    if (period && period.status !== "open") {
      throw new Error("The fiscal period is closed/locked");
    }

    const { data: je, error: jeErr } = await context.supabase
      .from("journal_entries")
      .insert({
        company_id: data.company_id,
        branch_id: data.branch_id,
        journal_id: data.journal_id,
        period_id: period?.id ?? null,
        entry_number: entryNumber,
        entry_date: data.entry_date,
        reference: data.reference,
        description: data.description,
        status: data.status,
        total_debit: totalDebit,
        total_credit: totalCredit,
        created_by: context.userId,
        posted_by: data.status === "posted" ? context.userId : null,
        posted_at: data.status === "posted" ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed to create entry");

    const lineRows = data.lines.map((l, idx) => ({
      entry_id: je.id,
      line_number: idx + 1,
      account_id: l.account_id,
      partner_id: l.partner_id || null,
      cost_center_id: l.cost_center_id || null,
      description: l.description || null,
      debit: l.debit,
      credit: l.credit,
    }));
    const { error: linesErr } = await context.supabase.from("journal_entry_lines").insert(lineRows);
    if (linesErr) {
      // rollback: delete header
      await context.supabase.from("journal_entries").delete().eq("id", je.id);
      throw new Error(linesErr.message);
    }

    // bump sequence
    await context.supabase
      .from("journals")
      .update({ sequence_next: seq + 1 })
      .eq("id", data.journal_id);

    return je;
  });

export const getTrialBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; asOfDate: string }) => i)
  .handler(async ({ data, context }) => {
    // Get all posted lines up to date
    const { data: rows, error } = await context.supabase
      .from("journal_entry_lines")
      .select(
        "debit, credit, accounts!inner(id, code, name_ar, name_en, account_type), journal_entries!inner(entry_date, status, company_id)",
      )
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", data.companyId)
      .lte("journal_entries.entry_date", data.asOfDate);
    if (error) throw new Error(error.message);

    const map = new Map<
      string,
      { id: string; code: string; name_ar: string; name_en: string; type: string; debit: number; credit: number }
    >();
    for (const r of rows ?? []) {
      const acc = (r as any).accounts;
      const cur = map.get(acc.id) ?? {
        id: acc.id,
        code: acc.code,
        name_ar: acc.name_ar,
        name_en: acc.name_en,
        type: acc.account_type,
        debit: 0,
        credit: 0,
      };
      cur.debit += Number(r.debit);
      cur.credit += Number(r.credit);
      map.set(acc.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  });

export const getDashboardKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; branchId: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // AR balance (account_type = asset & is_reconcilable receivable)
    // Sum debit-credit on accounts where reconcilable
    const { data: arAccounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", data.companyId)
      .eq("account_type", "asset")
      .eq("is_reconcilable", true);
    const arIds = (arAccounts ?? []).map((a) => a.id);

    const { data: apAccounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", data.companyId)
      .eq("account_type", "liability")
      .eq("is_reconcilable", true);
    const apIds = (apAccounts ?? []).map((a) => a.id);

    const sumBalance = async (accountIds: string[]) => {
      if (accountIds.length === 0) return 0;
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, journal_entries!inner(status, company_id)")
        .in("account_id", accountIds)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.company_id", data.companyId);
      return (lines ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    };

    const [receivables, payables, recentEntries] = await Promise.all([
      sumBalance(arIds),
      sumBalance(apIds).then((v) => -v), // payables natural credit
      supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, total_debit, status")
        .eq("branch_id", data.branchId)
        .order("entry_date", { ascending: false })
        .limit(8),
    ]);

    return {
      receivables,
      payables,
      cashPosition: 0,
      pendingApprovals: 0,
      recentEntries: recentEntries.data ?? [],
    };
  });
