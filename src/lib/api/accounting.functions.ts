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

// ---------------- Account Types: REMOVED ----------------
// The Account Types layer has been removed. Accounts now reference classifications
// directly via accounts.classification_id. Any legacy references should migrate to
// listClassifications / upsertAccount instead.


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
      .order("sort_order", { ascending: true })
      .order("statement")
      .order("code");

    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

const ClassificationUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50),

  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  statement: z.enum(STATEMENTS),
  normal_balance: z.enum(NORMAL_BALANCES),
  bucket: z.string().trim().min(1).max(50),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof ClassificationUpsertSchema>) =>
    ClassificationUpsertSchema.parse(i),
  )
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
        .from("classifications")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await (context.supabase as any)
      .from("classifications")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await (context.supabase as any)
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("classification_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error(
        "This classification is used by accounts and cannot be deleted | هذا التصنيف مستخدم في حسابات ولا يمكن حذفه",
      );


    const { error } = await (context.supabase as any)
      .from("classifications")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const swapClassificationOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { aId: string; bId: string }) =>
    z.object({ aId: z.string().uuid(), bId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("classifications")
      .select("id, sort_order")
      .in("id", [data.aId, data.bId]);
    if (error) throw new Error(error.message);
    const a = (rows ?? []).find((r: any) => r.id === data.aId);
    const b = (rows ?? []).find((r: any) => r.id === data.bId);
    if (!a || !b) throw new Error("Classification not found");
    const aOrder = a.sort_order ?? 0;
    const bOrder = b.sort_order ?? 0;
    const tmp = -Math.abs(aOrder) - Math.abs(bOrder) - 1;
    const e1 = await sb.from("classifications").update({ sort_order: tmp }).eq("id", a.id);
    if (e1.error) throw new Error(e1.error.message);
    const e2 = await sb.from("classifications").update({ sort_order: aOrder }).eq("id", b.id);
    if (e2.error) throw new Error(e2.error.message);
    const e3 = await sb.from("classifications").update({ sort_order: bOrder }).eq("id", a.id);
    if (e3.error) throw new Error(e3.error.message);
    return { ok: true };
  });

export const reorderClassifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; orderedIds: string[] }) =>
    z
      .object({
        companyId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("classifications")
      .select("id, company_id")
      .in("id", data.orderedIds);
    if (error) throw new Error(error.message);
    if (!rows || rows.length !== data.orderedIds.length) throw new Error("Some items not found");
    for (const r of rows) {
      if (r.company_id !== data.companyId) throw new Error("Cross-company reorder denied");
    }
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("classifications")
        .update({ sort_order: -(i + 1) })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("classifications")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    return { ok: true };
  });

// ---------------- Accounting Buckets (managed metadata per company) ----------------

export const listAccountingBuckets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("accounting_buckets")
      .select("*")
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("code");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

const AccountingBucketUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  statement: z.enum(STATEMENTS),
  normal_balance: z.enum(NORMAL_BALANCES),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertAccountingBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof AccountingBucketUpsertSchema>) =>
    AccountingBucketUpsertSchema.parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      statement: data.statement,
      normal_balance: data.normal_balance,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await (context.supabase as any)
        .from("accounting_buckets")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await (context.supabase as any)
      .from("accounting_buckets")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAccountingBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    // Look up the bucket to find its code, then ensure no classifications use it.
    const { data: b, error: bErr } = await sb
      .from("accounting_buckets")
      .select("id, company_id, code")
      .eq("id", data.id)
      .single();
    if (bErr) throw new Error(bErr.message);
    if (!b) throw new Error("Bucket not found");

    const { count } = await sb
      .from("classifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", b.company_id)
      .eq("bucket", b.code);
    if ((count ?? 0) > 0)
      throw new Error(
        "This bucket is linked to classifications and cannot be deleted | هذا البند مرتبط بتصنيفات ولا يمكن حذفه",
      );

    const { error } = await sb.from("accounting_buckets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderAccountingBuckets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; orderedIds: string[] }) =>
    z
      .object({
        companyId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("accounting_buckets")
      .select("id, company_id")
      .in("id", data.orderedIds);
    if (error) throw new Error(error.message);
    if (!rows || rows.length !== data.orderedIds.length) throw new Error("Some items not found");
    for (const r of rows) {
      if (r.company_id !== data.companyId) throw new Error("Cross-company reorder denied");
    }
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("accounting_buckets")
        .update({ sort_order: -(i + 1) })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("accounting_buckets")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    return { ok: true };
  });


// ---------------- Accounts ----------------

const AccountUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  account_type_id: z.string().trim().max(255).optional().nullable(),
  classification_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  currency_code: z.string().trim().min(1).max(10).nullable().optional(),
  is_group: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_reconcilable: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof AccountUpsertSchema>) => AccountUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Resolve classification (the only required taxonomy now that Account Types are removed).
    const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const { data: classifications, error: clsErr } = await context.supabase
      .from("classifications")
      .select("id, code, name_ar, name_en, bucket")
      .eq("company_id", data.company_id);
    if (clsErr) throw new Error(clsErr.message);

    const rawInput = (data.account_type_id ?? "").trim();
    let cls: any = null;
    if (data.classification_id) {
      cls = (classifications ?? []).find((c: any) => c.id === data.classification_id);
    }
    if (!cls && rawInput) {
      cls = UUID_RE.test(rawInput)
        ? (classifications ?? []).find((c: any) => c.id === rawInput)
        : (classifications ?? []).find((c: any) =>
            [c.code, c.name_ar, c.name_en, c.bucket].map(norm).includes(norm(rawInput)),
          );
    }
    if (!cls) throw new Error("اختر تصنيف الحساب أولاً | Please select an account classification first");

    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      account_type: cls.bucket,
      account_type_id: null,
      classification_id: cls.id,

      parent_id: data.parent_id ?? null,
      currency_code: data.currency_code || null,
      is_group: data.is_group ?? false,
      is_active: data.is_active ?? true,
      is_reconcilable: data.is_reconcilable ?? false,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("accounts")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("accounts")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });


export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Gather all references so the error message tells the user exactly where
    // the account is linked.
    const [children, journalLines, invoiceLines, taxesRef, partnersRecv, partnersPay, banks, journalsDr, journalsCr, assetsAsset, assetsDep, assetsAccDep, catAsset, catDep, catAccDep] = await Promise.all([
      sb.from("accounts").select("code, name_ar, name_en").eq("parent_id", data.id).limit(5),
      sb.from("journal_entry_lines").select("id", { count: "exact", head: true }).eq("account_id", data.id),
      sb.from("invoice_lines").select("id", { count: "exact", head: true }).eq("account_id", data.id),
      sb.from("taxes").select("code, name_ar, name_en").eq("account_id", data.id).limit(5),
      sb.from("partners").select("code, name_ar, name_en").eq("receivable_account_id", data.id).limit(5),
      sb.from("partners").select("code, name_ar, name_en").eq("payable_account_id", data.id).limit(5),
      sb.from("bank_accounts").select("code, name_ar, name_en").eq("gl_account_id", data.id).limit(5),
      sb.from("journals").select("code, name_ar, name_en").eq("default_debit_account_id", data.id).limit(5),
      sb.from("journals").select("code, name_ar, name_en").eq("default_credit_account_id", data.id).limit(5),
      sb.from("fixed_assets").select("code, name_ar, name_en").eq("asset_account_id", data.id).limit(5),
      sb.from("fixed_assets").select("code, name_ar, name_en").eq("depreciation_account_id", data.id).limit(5),
      sb.from("fixed_assets").select("code, name_ar, name_en").eq("accumulated_depreciation_account_id", data.id).limit(5),
      sb.from("asset_categories").select("code, name_ar, name_en").eq("asset_account_id", data.id).limit(5),
      sb.from("asset_categories").select("code, name_ar, name_en").eq("depreciation_account_id", data.id).limit(5),
      sb.from("asset_categories").select("code, name_ar, name_en").eq("accumulated_depreciation_account_id", data.id).limit(5),
    ]);

    const blocks: string[] = [];
    const fmt = (rows: Array<{ code: string; name_ar: string; name_en: string }> | null | undefined) =>
      (rows ?? []).map((r) => `${r.code} — ${r.name_ar || r.name_en}`).join("، ");

    if ((children.data?.length ?? 0) > 0) {
      blocks.push(`حسابات فرعية (${children.data!.length}): ${fmt(children.data)}`);
    }
    if ((journalLines.count ?? 0) > 0) {
      blocks.push(`قيود محاسبية (${journalLines.count} سطر)`);
    }
    if ((invoiceLines.count ?? 0) > 0) {
      blocks.push(`فواتير (${invoiceLines.count} سطر)`);
    }
    if ((taxesRef.data?.length ?? 0) > 0) {
      blocks.push(`ضرائب: ${fmt(taxesRef.data)}`);
    }
    if ((partnersRecv.data?.length ?? 0) > 0) {
      blocks.push(`عملاء (حساب مدين): ${fmt(partnersRecv.data)}`);
    }
    if ((partnersPay.data?.length ?? 0) > 0) {
      blocks.push(`موردين (حساب دائن): ${fmt(partnersPay.data)}`);
    }
    if ((banks.data?.length ?? 0) > 0) {
      blocks.push(`حسابات بنكية: ${fmt(banks.data)}`);
    }
    if ((journalsDr.data?.length ?? 0) > 0) {
      blocks.push(`دفاتر (مدين افتراضي): ${fmt(journalsDr.data)}`);
    }
    if ((journalsCr.data?.length ?? 0) > 0) {
      blocks.push(`دفاتر (دائن افتراضي): ${fmt(journalsCr.data)}`);
    }
    if ((assetsAsset.data?.length ?? 0) > 0) {
      blocks.push(`أصول ثابتة (حساب الأصل): ${fmt(assetsAsset.data)}`);
    }
    if ((assetsDep.data?.length ?? 0) > 0) {
      blocks.push(`أصول ثابتة (مصروف الإهلاك): ${fmt(assetsDep.data)}`);
    }
    if ((assetsAccDep.data?.length ?? 0) > 0) {
      blocks.push(`أصول ثابتة (مجمع الإهلاك): ${fmt(assetsAccDep.data)}`);
    }
    if ((catAsset.data?.length ?? 0) > 0) {
      blocks.push(`فئات أصول (حساب الأصل): ${fmt(catAsset.data)}`);
    }
    if ((catDep.data?.length ?? 0) > 0) {
      blocks.push(`فئات أصول (مصروف الإهلاك): ${fmt(catDep.data)}`);
    }
    if ((catAccDep.data?.length ?? 0) > 0) {
      blocks.push(`فئات أصول (مجمع الإهلاك): ${fmt(catAccDep.data)}`);
    }

    if (blocks.length > 0) {
      throw new Error(
        `لا يمكن حذف الحساب — مرتبط بـ: ${blocks.join(" | ")}`,
      );
    }

    const { error } = await sb.from("accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// bulkUpdateAccountType has been removed alongside Account Types.
// Use upsertAccount or a future bulk classification reassignment endpoint instead.


const ImportRowSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  account_type: z.string().trim().min(1).max(50),
  account_type_code: z.string().trim().max(50).optional().nullable(),
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
    z
      .object({
        companyId: z.string().uuid(),
        rows: z.array(ImportRowSchema).min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: exErr } = await context.supabase
      .from("accounts")
      .select("id, code")
      .eq("company_id", data.companyId);
    if (exErr) throw new Error(exErr.message);
    const codeToId = new Map<string, string>();
    (existing ?? []).forEach((r: any) => codeToId.set(r.code, r.id));

    // Load classifications for resolving account_type_code / account_type -> classification_id + bucket.
    const { data: classifications } = await context.supabase
      .from("classifications")
      .select("id, code, bucket, name_ar, name_en")
      .eq("company_id", data.companyId);
    const clsByKey = new Map<string, any>();
    (classifications ?? []).forEach((c: any) => {
      [c.code, c.bucket, c.name_ar, c.name_en].forEach((k) => {
        if (k) clsByKey.set(String(k).trim().toLowerCase(), c);
      });
    });

    // Sort: parents (no parent_code) first so parent_id can resolve
    const sorted = [...data.rows].sort(
      (a, b) => (a.parent_code ? 1 : 0) - (b.parent_code ? 1 : 0) || a.code.localeCompare(b.code),
    );

    let created = 0,
      updated = 0;
    const errors: { code: string; error: string }[] = [];

    for (const r of sorted) {
      const parent_id = r.parent_code ? (codeToId.get(r.parent_code) ?? null) : null;
      if (r.parent_code && !parent_id) {
        errors.push({ code: r.code, error: `Parent code "${r.parent_code}" not found` });
        continue;
      }
      const clsLookup =
        (r.account_type_code && clsByKey.get(String(r.account_type_code).trim().toLowerCase())) ||
        (r.account_type && clsByKey.get(String(r.account_type).trim().toLowerCase())) ||
        null;
      if (!clsLookup) {
        errors.push({
          code: r.code,
          error: `Classification not found for "${r.account_type_code ?? r.account_type}"`,
        });
        continue;
      }
      const payload: any = {
        company_id: data.companyId,
        code: r.code,
        name_ar: r.name_ar,
        name_en: r.name_en,
        account_type: clsLookup.bucket,
        classification_id: clsLookup.id,
        account_type_id: null,
        parent_id,
        currency_code: r.currency_code || null,
        is_group: r.is_group ?? false,
        is_active: r.is_active ?? true,
        is_reconcilable: r.is_reconcilable ?? false,
        notes: r.notes || null,
      };


      const existingId = codeToId.get(r.code);
      if (existingId) {
        const { error } = await context.supabase
          .from("accounts")
          .update(payload)
          .eq("id", existingId);
        if (error) {
          errors.push({ code: r.code, error: error.message });
          continue;
        }
        updated++;
      } else {
        const { data: ins, error } = await context.supabase
          .from("accounts")
          .insert(payload)
          .select("id, code")
          .single();
        if (error) {
          errors.push({ code: r.code, error: error.message });
          continue;
        }
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
    const { data: row, error } = await context.supabase
      .from("partners")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdatePartnerSchema = CreatePartnerSchema.partial().extend({
  id: z.string().uuid(),
});

export const updatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdatePartnerSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("partners")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("partners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Partner Contacts ----------------

export const listPartnerContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { partnerId: string }) =>
    z.object({ partnerId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("partner_contacts")
      .select("*")
      .eq("partner_id", data.partnerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  mobile: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().nullable(),
});

export const savePartnerContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      partnerId: z.string().uuid(),
      contacts: z.array(ContactSchema).max(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing, error: e1 } = await sb
      .from("partner_contacts")
      .select("id")
      .eq("partner_id", data.partnerId);
    if (e1) throw new Error(e1.message);

    const keepIds = new Set(data.contacts.filter((c) => c.id).map((c) => c.id!));
    const toDelete = (existing ?? []).filter((r: any) => !keepIds.has(r.id)).map((r: any) => r.id);

    if (toDelete.length > 0) {
      const { error } = await sb.from("partner_contacts").delete().in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    for (const c of data.contacts) {
      const payload = {
        partner_id: data.partnerId,
        name: c.name,
        mobile: c.mobile || null,
        email: c.email || null,
        notes: c.notes || null,
      };
      if (c.id) {
        const { error } = await sb.from("partner_contacts").update(payload).eq("id", c.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from("partner_contacts").insert(payload);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
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



const JOURNAL_TYPES = ["sales", "purchase", "bank", "cash", "misc"] as const;

export const listJournalsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("journals")
      .select(
        "*, default_debit_account:accounts!journals_default_debit_account_id_fkey(id, code, name_ar, name_en), default_credit_account:accounts!journals_default_credit_account_id_fkey(id, code, name_ar, name_en)",
      )
      .eq("company_id", data.companyId)
      .order("journal_type")
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    company_id: string;
    code: string;
    name_ar: string;
    name_en: string;
    journal_type: (typeof JOURNAL_TYPES)[number];
    sequence_prefix: string | null;
    sequence_next: number;
    currency_code: string | null;
    default_debit_account_id: string | null;
    default_credit_account_id: string | null;
    is_active: boolean;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        company_id: z.string().uuid(),
        code: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
        name_ar: z.string().min(1).max(255),
        name_en: z.string().min(1).max(255),
        journal_type: z.enum(JOURNAL_TYPES),
        sequence_prefix: z.string().max(20).nullable(),
        sequence_next: z.number().int().min(1),
        currency_code: z.string().min(3).max(3).nullable(),
        default_debit_account_id: z.string().uuid().nullable(),
        default_credit_account_id: z.string().uuid().nullable(),
        is_active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      company_id: data.company_id,
      code: data.code.trim().toUpperCase(),
      name_ar: data.name_ar.trim(),
      name_en: data.name_en.trim(),
      journal_type: data.journal_type,
      sequence_prefix: data.sequence_prefix?.trim() || null,
      sequence_next: data.sequence_next,
      currency_code: data.currency_code || null,
      default_debit_account_id: data.default_debit_account_id,
      default_credit_account_id: data.default_credit_account_id,
      is_active: data.is_active,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("journals")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("journals")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("journal_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error("Journal has entries and cannot be deleted | الدفتر مستخدم في قيود ولا يمكن حذفه");
    const { error } = await context.supabase.from("journals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
  .inputValidator((i: { companyId: string; asOfDate: string; dateFrom?: string | null }) => i)
  .handler(async ({ data, context }) => {
    // Build classification metadata per account so the TB groups can show
    // the user-defined classification name/bucket rather than the legacy enum only.
    const [{ data: classifications }, { data: accountsList }] =
      await Promise.all([
        context.supabase
          .from("classifications")
          .select("id, code, name_ar, name_en, statement, normal_balance, bucket")
          .eq("company_id", data.companyId),
        context.supabase
          .from("accounts")
          .select("id, classification_id, account_type")
          .eq("company_id", data.companyId),
      ]);
    const clsById = new Map<string, any>();
    (classifications ?? []).forEach((c: any) => clsById.set(c.id, c));
    const clsByBucket = new Map<string, any>();
    (classifications ?? []).forEach((c: any) => {
      if (!clsByBucket.has(c.bucket)) clsByBucket.set(c.bucket, c);
    });
    const acctMeta = new Map<string, any>();
    for (const a of accountsList ?? []) {
      let cls: any = null;
      if (a.classification_id) cls = clsById.get(a.classification_id) ?? null;
      if (!cls) cls = clsByBucket.get(a.account_type) ?? null;
      acctMeta.set(a.id, {
        classification_id: cls?.id ?? null,
        classification_code: cls?.code ?? null,
        classification_name_ar: cls?.name_ar ?? null,
        classification_name_en: cls?.name_en ?? null,
        bucket: cls?.bucket ?? a.account_type,
        statement: cls?.statement ?? null,
        normal_balance: cls?.normal_balance ?? null,
      });
    }

    // Get all posted lines up to asOfDate (closing) — we'll split into beginning vs period via dateFrom.
    const { data: rows, error } = await context.supabase
      .from("journal_entry_lines")
      .select(
        "debit, credit, accounts!inner(id, code, name_ar, name_en, account_type), journal_entries!inner(entry_date, status, company_id)",
      )
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", data.companyId)
      .lte("journal_entries.entry_date", data.asOfDate);
    if (error) throw new Error(error.message);

    const dateFrom = data.dateFrom || null;

    type TBRow = {
      id: string; code: string; name_ar: string; name_en: string; type: string;
      classification_id: string | null; classification_code: string | null;
      classification_name_ar: string | null; classification_name_en: string | null;
      bucket: string; statement: string | null; normal_balance: string | null;
      beginning_debit: number; beginning_credit: number;
      debit: number; credit: number;
    };
    const map = new Map<string, TBRow>();

    for (const r of rows ?? []) {
      const acc = (r as any).accounts;
      const je = (r as any).journal_entries;
      const meta = acctMeta.get(acc.id) ?? {
        classification_id: null, classification_code: null,
        classification_name_ar: null, classification_name_en: null,
        bucket: acc.account_type, statement: null, normal_balance: null,
      };
      const cur = map.get(acc.id) ?? {
        id: acc.id, code: acc.code, name_ar: acc.name_ar, name_en: acc.name_en,
        type: acc.account_type, ...meta,
        beginning_debit: 0, beginning_credit: 0,
        debit: 0, credit: 0,
      };
      const d = Number(r.debit); const c = Number(r.credit);
      // Lines strictly BEFORE dateFrom accumulate into beginning balance.
      // When no dateFrom is provided, treat all lines as period (no beginning).
      if (dateFrom && je.entry_date < dateFrom) {
        cur.beginning_debit += d;
        cur.beginning_credit += c;
      } else {
        cur.debit += d;
        cur.credit += c;
      }
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

// ---------------- Cost Centers ----------------

export const listCostCenters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cost_centers")
      .select("*")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CostCenterUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
  is_group: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const upsertCostCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof CostCenterUpsertSchema>) => CostCenterUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (data.parent_id) {
      if (data.id && data.parent_id === data.id) {
        throw new Error(
          "Cost center cannot be its own parent | لا يمكن أن يكون مركز التكلفة أبًا لنفسه",
        );
      }
      const { data: parent, error: pErr } = await context.supabase
        .from("cost_centers")
        .select("id, company_id, is_group")
        .eq("id", data.parent_id)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!parent) throw new Error("Parent not found | الأب غير موجود");
      if (parent.company_id !== data.company_id) {
        throw new Error("Parent belongs to another company | الأب يخص شركة أخرى");
      }
      if (!parent.is_group) {
        throw new Error("Parent must be a group | يجب أن يكون الأب مجموعة");
      }
    }

    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      parent_id: data.parent_id ?? null,
      is_group: data.is_group ?? false,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("cost_centers")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("cost_centers")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCostCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count: childCount } = await context.supabase
      .from("cost_centers")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", data.id);
    if ((childCount ?? 0) > 0) {
      throw new Error("Cost center has children | يحتوي على عناصر تابعة");
    }
    const { count: usedCount } = await context.supabase
      .from("journal_entry_lines")
      .select("id", { count: "exact", head: true })
      .eq("cost_center_id", data.id);
    if ((usedCount ?? 0) > 0) {
      throw new Error("Cost center is used in journal entries | مستخدم في قيود محاسبية");
    }
    const { error } = await context.supabase.from("cost_centers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
