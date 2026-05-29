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
    const { data: rows, error } = await (context.supabase as any)
      .from("account_types")
      .select("*")
      .eq("company_id", data.companyId)
      .order("classification")
      .order("sort_order", { ascending: true })
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const moveAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; direction: "up" | "down" }) =>
    z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: cur, error: e1 } = await sb
      .from("account_types")
      .select("id, company_id, parent_id, classification, sort_order, code")
      .eq("id", data.id)
      .single();
    if (e1 || !cur) throw new Error(e1?.message || "Not found");

    let q = sb
      .from("account_types")
      .select("id, sort_order, code")
      .eq("company_id", cur.company_id)
      .eq("classification", cur.classification);
    q = cur.parent_id ? q.eq("parent_id", cur.parent_id) : q.is("parent_id", null);
    const { data: siblings, error: e2 } = await q;
    if (e2) throw new Error(e2.message);

    const sorted = (siblings ?? [])
      .slice()
      .sort(
        (a: any, b: any) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.code).localeCompare(String(b.code)),
      );
    const idx = sorted.findIndex((r: any) => r.id === cur.id);
    const swapIdx = data.direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return { ok: true, moved: false };

    // Normalize sort_order across siblings to guarantee distinct values, then swap.
    for (let i = 0; i < sorted.length; i++) {
      const desired = (i + 1) * 10;
      if ((sorted[i].sort_order ?? -1) !== desired) {
        const u = await sb
          .from("account_types")
          .update({ sort_order: desired })
          .eq("id", sorted[i].id);
        if (u.error) throw new Error(u.error.message);
        sorted[i].sort_order = desired;
      }
    }
    const a = sorted[idx],
      b = sorted[swapIdx];
    const aOrder = a.sort_order as number;
    const bOrder = b.sort_order as number;
    const tmp = -(aOrder + bOrder + 1);
    let r = await sb.from("account_types").update({ sort_order: tmp }).eq("id", a.id);
    if (r.error) throw new Error(r.error.message);
    r = await sb.from("account_types").update({ sort_order: aOrder }).eq("id", b.id);
    if (r.error) throw new Error(r.error.message);
    r = await sb.from("account_types").update({ sort_order: bOrder }).eq("id", a.id);
    if (r.error) throw new Error(r.error.message);
    return { ok: true, moved: true };
  });

// Reorder a sibling group. Root account types can move across classifications;
// child account types must stay within the same parent classification.
export const reorderAccountTypes = createServerFn({ method: "POST" })
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
    // Verify all belong to same company + parent. Children must also share classification.
    const { data: rows, error } = await sb
      .from("account_types")
      .select("id, company_id, parent_id, classification")
      .in("id", data.orderedIds);
    if (error) throw new Error(error.message);
    if (!rows || rows.length !== data.orderedIds.length) throw new Error("Some items not found");
    const first = rows[0];
    for (const r of rows) {
      if (r.company_id !== data.companyId) throw new Error("Cross-company reorder denied");
      if ((r.parent_id ?? null) !== (first.parent_id ?? null)) {
        throw new Error("All items must be siblings (same parent)");
      }
      if (first.parent_id && r.classification !== first.classification) {
        throw new Error("Child items must stay within the same classification");
      }
    }
    // First pass: bump to negative temp to avoid uniqueness conflicts (none here, but safe).
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("account_types")
        .update({ sort_order: -(i + 1) })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    for (let i = 0; i < data.orderedIds.length; i++) {
      const u = await sb
        .from("account_types")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", data.orderedIds[i]);
      if (u.error) throw new Error(u.error.message);
    }
    return { ok: true };
  });

const AccountTypeUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().trim().min(1).max(50),
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  classification: z.string().trim().min(1).max(50),
  classification_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  is_group: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof AccountTypeUpsertSchema>) => AccountTypeUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    let classification = data.classification;
    // Validate classification_id relationship if provided
    if (data.classification_id) {
      const { data: cls, error: clsErr } = await context.supabase
        .from("classifications")
        .select("id, company_id, is_active, bucket")
        .eq("id", data.classification_id)
        .maybeSingle();
      if (clsErr) throw new Error(clsErr.message);
      if (!cls) throw new Error("Selected classification not found | التصنيف المحدد غير موجود");
      if (cls.company_id !== data.company_id) {
        throw new Error("Classification belongs to another company | التصنيف يخص شركة أخرى");
      }
      if (!cls.is_active) {
        throw new Error("Selected classification is inactive | التصنيف المحدد غير مفعل");
      }
      classification = cls.bucket as any;
    }

    // Prevent changing bucket on a type already used by accounts of a different bucket
    if (data.id) {
      const { data: existing } = await context.supabase
        .from("account_types")
        .select("classification")
        .eq("id", data.id)
        .maybeSingle();
      if (existing && existing.classification !== classification) {
        const { count } = await context.supabase
          .from("accounts")
          .select("id", { count: "exact", head: true })
          .eq("account_type_id", data.id);
        if ((count ?? 0) > 0) {
          throw new Error(
            "Cannot change bucket: type is used by existing accounts | لا يمكن تغيير التصنيف الأساسي لأن النوع مستخدم في حسابات قائمة",
          );
        }
      }
    }

    const payload: any = {
      company_id: data.company_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      classification,
      classification_id: data.classification_id ?? null,
      parent_id: data.parent_id ?? null,
      is_group: data.is_group ?? false,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("account_types")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("account_types")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count: childCount } = await context.supabase
      .from("account_types")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", data.id);
    if ((childCount ?? 0) > 0)
      throw new Error(
        "This type has children and cannot be deleted | هذا النوع يحتوي على أنواع فرعية ولا يمكن حذفه",
      );

    const { count } = await context.supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("account_type_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error(
        "This type is used by accounts and cannot be deleted | هذا النوع مستخدم في حسابات ولا يمكن حذفه",
      );

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
      .from("account_types")
      .select("id", { count: "exact", head: true })
      .eq("classification_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error(
        "This classification is linked to account types and cannot be deleted | هذا التصنيف مرتبط بأنواع حسابات ولا يمكن حذفه",
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
      .from("account_types")
      .select("classification")
      .eq("id", data.account_type_id)
      .single();
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
    // Block delete if account is used in journal lines or as a child parent
    const [{ count: linesCount }, { count: childCount }] = await Promise.all([
      context.supabase
        .from("journal_entry_lines")
        .select("id", { count: "exact", head: true })
        .eq("account_id", data.id),
      context.supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", data.id),
    ]);
    if ((linesCount ?? 0) > 0)
      throw new Error("Account is used in journal entries and cannot be deleted");
    if ((childCount ?? 0) > 0) throw new Error("Account has child accounts and cannot be deleted");
    const { error } = await context.supabase.from("accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bulk reassign accounts to a different account_type (which drives classification via DB trigger).
export const bulkUpdateAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; accountIds: string[]; accountTypeId: string }) =>
    z
      .object({
        companyId: z.string().uuid(),
        accountIds: z.array(z.string().uuid()).min(1).max(2000),
        accountTypeId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: at, error: atErr } = await context.supabase
      .from("account_types")
      .select("classification, company_id")
      .eq("id", data.accountTypeId)
      .single();
    if (atErr || !at) throw new Error("Invalid account type");
    if (at.company_id !== data.companyId)
      throw new Error("Account type does not belong to this company");

    const { error } = await context.supabase
      .from("accounts")
      .update({ account_type_id: data.accountTypeId, account_type: at.classification })
      .in("id", data.accountIds)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.accountIds.length };
  });

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
    // Build classification metadata per account so the TB groups can show
    // the user-defined classification name/bucket rather than the legacy enum only.
    const [{ data: classifications }, { data: accountTypes }, { data: accountsList }] =
      await Promise.all([
        context.supabase
          .from("classifications")
          .select("id, code, name_ar, name_en, statement, normal_balance, bucket")
          .eq("company_id", data.companyId),
        context.supabase
          .from("account_types")
          .select("id, classification_id, classification")
          .eq("company_id", data.companyId),
        context.supabase
          .from("accounts")
          .select("id, account_type_id, account_type")
          .eq("company_id", data.companyId),
      ]);
    const clsById = new Map<string, any>();
    (classifications ?? []).forEach((c: any) => clsById.set(c.id, c));
    const clsByBucket = new Map<string, any>();
    (classifications ?? []).forEach((c: any) => {
      if (!clsByBucket.has(c.bucket)) clsByBucket.set(c.bucket, c);
    });
    const typeById = new Map<string, any>();
    (accountTypes ?? []).forEach((t: any) => typeById.set(t.id, t));
    const acctMeta = new Map<string, any>();
    for (const a of accountsList ?? []) {
      let cls: any = null;
      if (a.account_type_id) {
        const at = typeById.get(a.account_type_id);
        if (at?.classification_id) cls = clsById.get(at.classification_id) ?? null;
        if (!cls && at?.classification) cls = clsByBucket.get(at.classification) ?? null;
      }
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
      {
        id: string;
        code: string;
        name_ar: string;
        name_en: string;
        type: string;
        classification_id: string | null;
        classification_code: string | null;
        classification_name_ar: string | null;
        classification_name_en: string | null;
        bucket: string;
        statement: string | null;
        normal_balance: string | null;
        debit: number;
        credit: number;
      }
    >();
    for (const r of rows ?? []) {
      const acc = (r as any).accounts;
      const meta = acctMeta.get(acc.id) ?? {
        classification_id: null,
        classification_code: null,
        classification_name_ar: null,
        classification_name_en: null,
        bucket: acc.account_type,
        statement: null,
        normal_balance: null,
      };
      const cur = map.get(acc.id) ?? {
        id: acc.id,
        code: acc.code,
        name_ar: acc.name_ar,
        name_en: acc.name_en,
        type: acc.account_type,
        ...meta,
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
