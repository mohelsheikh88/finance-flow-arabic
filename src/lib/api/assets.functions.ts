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
