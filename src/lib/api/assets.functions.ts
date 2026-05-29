import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ListInput = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
});

export const listAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("fixed_assets")
      .select("*, asset_categories(name_ar, name_en, code)")
      .eq("company_id", data.companyId)
      .order("acquisition_date", { ascending: false });
    if (data.branchId) q = q.eq("branch_id", data.branchId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { assets: rows || [] };
  });

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("asset_categories")
      .select("*")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return { categories: rows || [] };
  });

const CreateCat = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  asset_account_id: z.string().uuid().nullable(),
  depreciation_account_id: z.string().uuid().nullable(),
  accumulated_depreciation_account_id: z.string().uuid().nullable(),
  default_useful_life_months: z.number().int().min(1),
  default_depreciation_method: z.enum(["straight_line", "declining_balance"]),
});

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateCat.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("asset_categories").insert({
      company_id: data.companyId,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      asset_account_id: data.asset_account_id,
      depreciation_account_id: data.depreciation_account_id,
      accumulated_depreciation_account_id: data.accumulated_depreciation_account_id,
      default_useful_life_months: data.default_useful_life_months,
      default_depreciation_method: data.default_depreciation_method,
    }).select().single();
    if (error) throw new Error(error.message);
    return { category: row };
  });

const CreateAsset = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  code: z.string().min(1),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description: z.string().optional(),
  acquisition_date: z.string(),
  acquisition_cost: z.number().min(0),
  salvage_value: z.number().min(0).default(0),
  useful_life_months: z.number().int().min(1),
  depreciation_method: z.enum(["straight_line", "declining_balance"]),
  depreciation_start_date: z.string(),
  asset_account_id: z.string().uuid().nullable(),
  depreciation_account_id: z.string().uuid().nullable(),
  accumulated_depreciation_account_id: z.string().uuid().nullable(),
});

export const createAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateAsset.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const book = data.acquisition_cost;
    const { data: asset, error } = await supabase.from("fixed_assets").insert({
      company_id: data.companyId,
      branch_id: data.branchId,
      category_id: data.category_id,
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en,
      description: data.description || null,
      acquisition_date: data.acquisition_date,
      acquisition_cost: data.acquisition_cost,
      salvage_value: data.salvage_value,
      useful_life_months: data.useful_life_months,
      depreciation_method: data.depreciation_method,
      depreciation_start_date: data.depreciation_start_date,
      asset_account_id: data.asset_account_id,
      depreciation_account_id: data.depreciation_account_id,
      accumulated_depreciation_account_id: data.accumulated_depreciation_account_id,
      current_book_value: book,
      status: "active",
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);

    // Generate depreciation schedule (straight-line)
    const depreciableBase = data.acquisition_cost - data.salvage_value;
    const monthlyDep = depreciableBase / data.useful_life_months;
    const schedule: any[] = [];
    let accumulated = 0;
    const start = new Date(data.depreciation_start_date);
    for (let i = 0; i < data.useful_life_months; i++) {
      const period = new Date(start);
      period.setMonth(period.getMonth() + i);
      const dep = i === data.useful_life_months - 1
        ? depreciableBase - accumulated
        : monthlyDep;
      accumulated += dep;
      schedule.push({
        asset_id: asset.id,
        period_date: period.toISOString().split("T")[0],
        depreciation_amount: Number(dep.toFixed(2)),
        accumulated_depreciation: Number(accumulated.toFixed(2)),
        book_value: Number((data.acquisition_cost - accumulated).toFixed(2)),
      });
    }
    if (schedule.length) {
      const { error: se } = await supabase.from("depreciation_schedule").insert(schedule);
      if (se) throw new Error(se.message);
    }
    return { asset };
  });

export const getDepreciationSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("depreciation_schedule")
      .select("*")
      .eq("asset_id", data.assetId)
      .order("period_date");
    if (error) throw new Error(error.message);
    return { schedule: rows || [] };
  });

/**
 * Post all due depreciation schedule rows (period_date <= asOf, not yet posted)
 * for the given company. Creates one JE per asset per period:
 *   Dr Depreciation Expense / Cr Accumulated Depreciation.
 * Updates the asset's accumulated depreciation, book value, and status.
 *
 * Safe to call repeatedly — already-posted rows are skipped.
 */
export async function postDueDepreciationCore(
  supabase: any,
  userId: string | null,
  args: { companyId?: string; asOf?: string } = {},
) {
  const asOf = args.asOf ?? new Date().toISOString().split("T")[0];

  // Pull all unposted due rows joined with asset + accounts
  let q = supabase
    .from("depreciation_schedule")
    .select(`
      id, period_date, depreciation_amount, accumulated_depreciation, book_value, asset_id,
      fixed_assets!inner(
        id, company_id, branch_id, code, name_ar, name_en, partner_id,
        depreciation_account_id, accumulated_depreciation_account_id,
        acquisition_cost, useful_life_months
      )
    `)
    .eq("is_posted", false)
    .lte("period_date", asOf)
    .order("period_date");
  if (args.companyId) q = q.eq("fixed_assets.company_id", args.companyId);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    return { posted: 0, skipped: 0, errors: [] as Array<{ id: string; reason: string }> };
  }

  // Cache misc journal per company
  const journalCache = new Map<string, { id: string; prefix: string }>();
  async function getMiscJournal(companyId: string) {
    if (journalCache.has(companyId)) return journalCache.get(companyId)!;
    const { data: j } = await supabase
      .from("journals")
      .select("id, sequence_prefix")
      .eq("company_id", companyId)
      .eq("journal_type", "misc")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!j) throw new Error(`No misc/general journal configured for company ${companyId}`);
    const entry = { id: j.id, prefix: j.sequence_prefix ?? "DEP" };
    journalCache.set(companyId, entry);
    return entry;
  }

  let posted = 0;
  let skipped = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const row of rows as any[]) {
    const asset = row.fixed_assets;
    if (!asset) { skipped++; continue; }
    if (!asset.depreciation_account_id || !asset.accumulated_depreciation_account_id) {
      errors.push({ id: row.id, reason: `Asset ${asset.code} missing depreciation accounts` });
      skipped++;
      continue;
    }
    try {
      const journal = await getMiscJournal(asset.company_id);

      // Period for this date
      const { data: period } = await supabase
        .from("fiscal_periods")
        .select("id, status")
        .eq("company_id", asset.company_id)
        .lte("date_from", row.period_date)
        .gte("date_to", row.period_date)
        .maybeSingle();
      if (period && period.status !== "open") {
        errors.push({ id: row.id, reason: "Fiscal period closed" });
        skipped++;
        continue;
      }

      // Next sequence
      const { data: jSeq } = await supabase
        .from("journals")
        .select("sequence_next")
        .eq("id", journal.id)
        .single();
      const seq = jSeq?.sequence_next ?? 1;
      const yr = new Date(row.period_date).getFullYear();
      const entryNumber = `${journal.prefix}/${yr}/${String(seq).padStart(5, "0")}`;
      const amount = Number(row.depreciation_amount);

      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          company_id: asset.company_id,
          branch_id: asset.branch_id,
          journal_id: journal.id,
          period_id: period?.id ?? null,
          entry_number: entryNumber,
          entry_date: row.period_date,
          reference: `DEP-${asset.code}`,
          description: `Depreciation – ${asset.code} ${asset.name_en} (${row.period_date})`,
          status: "posted",
          total_debit: amount,
          total_credit: amount,
          source_type: "depreciation",
          source_id: row.id,
          created_by: userId,
          posted_by: userId,
          posted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (jeErr || !je) throw new Error(jeErr?.message ?? "Failed JE");

      const { error: lErr } = await supabase.from("journal_entry_lines").insert([
        {
          entry_id: je.id,
          line_number: 1,
          account_id: asset.depreciation_account_id,
          partner_id: asset.partner_id ?? null,
          description: `Depreciation expense – ${asset.code}`,
          debit: amount,
          credit: 0,
        },
        {
          entry_id: je.id,
          line_number: 2,
          account_id: asset.accumulated_depreciation_account_id,
          partner_id: asset.partner_id ?? null,
          description: `Accumulated depreciation – ${asset.code}`,
          debit: 0,
          credit: amount,
        },
      ]);
      if (lErr) {
        await supabase.from("journal_entries").delete().eq("id", je.id);
        throw new Error(lErr.message);
      }

      await supabase.from("journals").update({ sequence_next: seq + 1 }).eq("id", journal.id);

      await supabase
        .from("depreciation_schedule")
        .update({
          is_posted: true,
          journal_entry_id: je.id,
          posted_at: new Date().toISOString(),
          posted_by: userId,
        })
        .eq("id", row.id);

      // Update asset rollup
      const newAccum = Number(row.accumulated_depreciation);
      const newBook = Number(row.book_value);
      await supabase

        .from("fixed_assets")
        .update({
          accumulated_depreciation: newAccum,
          current_book_value: newBook,
          status: newAccum >= Number(asset.acquisition_cost) - 0.01 ? "fully_depreciated" : "active",
        })
        .eq("id", asset.id);

      posted++;
    } catch (e: any) {
      errors.push({ id: row.id, reason: e.message });
      skipped++;
    }
  }

  return { posted, skipped, errors };
}

export const postDueDepreciation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      companyId: z.string().uuid().optional(),
      asOf: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    return postDueDepreciationCore(context.supabase, context.userId!, data);
  });

