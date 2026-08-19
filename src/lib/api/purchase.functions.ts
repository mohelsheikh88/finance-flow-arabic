import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

// ================= Purchase Categories (hierarchical) =================

export const listPurchaseCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("purchase_categories")
      .select("*")
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const PurchaseCategorySchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  is_group: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertPurchaseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PurchaseCategorySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("purchase_categories")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("purchase_categories")
      .insert(patch)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePurchaseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count: childCount } = await context.supabase
      .from("purchase_categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", data.id);
    if ((childCount ?? 0) > 0) {
      throw new Error("Category has sub-categories | يحتوي على تصنيفات فرعية");
    }
    const { count: productCount } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if ((productCount ?? 0) > 0) {
      throw new Error("Category has products assigned | يحتوي على منتجات مرتبطة به");
    }
    const { error } = await context.supabase.from("purchase_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= UoM Categories =================

export const listUomCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("uom_categories")
      .select("*")
      .eq("company_id", data.companyId)
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const UomCategorySchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  is_active: z.boolean().default(true),
});

export const upsertUomCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UomCategorySchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("uom_categories").update(patch).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("uom_categories").insert(patch).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteUomCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("units_of_measure")
      .select("id", { count: "exact", head: true })
      .eq("uom_category_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("This UoM category has units in it | تحتوي على وحدات قياس");
    }
    const { error } = await context.supabase.from("uom_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= Units of Measure =================

export const listUnitsOfMeasure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("units_of_measure")
      .select("*")
      .eq("company_id", data.companyId)
      .order("factor", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const UomSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  uom_category_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  factor: z.number().positive(),
  is_reference: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const upsertUnitOfMeasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UomSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("units_of_measure").update(patch).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("units_of_measure").insert(patch).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteUnitOfMeasure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("purchase_uom_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("This unit is used by products | مستخدمة في منتجات");
    }
    const { error } = await context.supabase.from("units_of_measure").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= Products =================

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("products")
      .select("*")
      .eq("company_id", data.companyId)
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  category_id: z.string().uuid().nullable().optional(),
  product_type: z.enum(["good", "service", "other"]).default("good"),
  purchase_uom_id: z.string().uuid().nullable().optional(),
  cost_price: z.number().min(0).default(0),
  currency_code: z.string().default("SAR"),
  expense_account_id: z.string().uuid().nullable().optional(),
  requires_batch_tracking: z.boolean().default(false),
  requires_expiry_tracking: z.boolean().default(false),
  requires_cold_chain: z.boolean().default(false),
  is_controlled_substance: z.boolean().default(false),
  requires_prescription: z.boolean().default(false),
  regulatory_number: z.string().max(100).nullable().optional(),
  reorder_point: z.number().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ProductSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("products").update(patch).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("products").insert(patch).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
