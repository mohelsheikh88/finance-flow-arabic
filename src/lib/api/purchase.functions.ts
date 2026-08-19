import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

// ================= Purchase Categories (hierarchical) =================

// ================= Product Types (manageable list) =================

export const listProductTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("product_types")
      .select("*")
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ProductTypeSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  tracks_inventory: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export const upsertProductType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ProductTypeSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("product_types").update(patch).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("product_types").insert(patch).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProductType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("product_type_id", data.id);
    if (count && count > 0) {
      throw new Error("Cannot delete a product type that's already used by products");
    }
    const { error } = await context.supabase.from("product_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
  stock_input_account_id: z.string().uuid().nullable().optional(),
  stock_output_account_id: z.string().uuid().nullable().optional(),
  costing_method: z.enum(["standard", "fifo", "avco"]).default("fifo"),
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
  category_id: z.string().uuid({ message: "Category is required" }),
  product_type_id: z.string().uuid({ message: "Product Type is required" }),
  purchase_uom_id: z.string().uuid().nullable().optional(),
  cost_price: z.number().min(0).default(0),
  currency_code: z.string().default("SAR"),
  expense_account_id: z.string().uuid().nullable().optional(),
  requires_batch_tracking: z.boolean().default(false),
  requires_expiry_tracking: z.boolean().default(false),
  requires_cold_chain: z.boolean().default(false),
  is_controlled_substance: z.boolean().default(false),
  requires_prescription: z.boolean().default(false),
  regulatory_number: z.string().min(1, "Regulatory number is required").max(100),
  barcode: z.string().min(1, "Barcode is required").max(50)
    .refine((v) => /^\d{8,14}$/.test(v), { message: "Barcode must be 8-14 digits" }),
  reorder_point: z.number().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ProductSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const friendlyError = (msg: string) =>
      msg.includes("idx_products_barcode") ? "This barcode is already used by another product" : msg;

    const { data: pt, error: ptErr } = await context.supabase
      .from("product_types")
      .select("tracks_inventory")
      .eq("id", data.product_type_id)
      .single();
    if (ptErr || !pt) throw new Error("Invalid Product Type");
    if (pt.tracks_inventory) {
      if (!patch.purchase_uom_id) throw new Error("Unit of Measure is required for this product type");
      if (patch.reorder_point == null) throw new Error("Reorder point is required for this product type");
    } else if (!patch.expense_account_id) {
      throw new Error("Expense account is required for this product type");
    }

    if (id) {
      const { data: row, error } = await context.supabase.from("products").update(patch).eq("id", id).select().single();
      if (error) throw new Error(friendlyError(error.message));
      return row;
    }
    const { data: row, error } = await context.supabase.from("products").insert(patch).select().single();
    if (error) throw new Error(friendlyError(error.message));
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

// ================= Warehouses (placeholder until Inventory owns them) =================

export const listWarehouses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("warehouses")
      .select("*")
      .eq("company_id", data.companyId)
      .eq("is_active", true)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ================= Purchase Orders =================

export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("purchase_orders")
      .select("*")
      .eq("company_id", data.companyId)
      .order("order_date", { ascending: false })
      .order("po_number", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPurchaseOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: po, error: pe } = await context.supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (pe) throw new Error(pe.message);
    const { data: lines, error: le } = await context.supabase
      .from("purchase_order_lines")
      .select("*")
      .eq("purchase_order_id", data.id)
      .order("sort_order", { ascending: true });
    if (le) throw new Error(le.message);
    return { ...po, lines: lines ?? [] };
  });

const PoLineSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  quantity: z.number().positive(),
  uom_id: z.string().uuid().nullable().optional(),
  unit_price: z.number().min(0),
  bonus: z.number().min(0).default(0),
  discount1_pct: z.number().min(0).max(100).default(0),
  discount2_pct: z.number().min(0).max(100).default(0),
  tax_id: z.string().uuid().nullable().optional(),
  tax_rate: z.number().min(0).max(100).default(0),
});

const PoUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
  vendor_id: z.string().uuid(),
  vendor_reference: z.string().max(100).nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  bill_control: z.enum(["ordered", "received"]).default("received"),
  order_date: z.string(),
  expected_delivery_date: z.string().nullable().optional(),
  currency_code: z.string().default("SAR"),
  payment_term_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(PoLineSchema).min(1),
});

// Base -> Discount 1 -> Discount 2 (cascading, each applied on what's left
// after the previous one) -> Tax on the discounted amount. Bonus is an
// informational free-extra-quantity note and does not affect the total.
function computeTotals(lines: z.infer<typeof PoLineSchema>[]) {
  let subtotal = 0;
  let taxTotal = 0;
  const computed = lines.map((l) => {
    const base = l.quantity * l.unit_price;
    const afterDisc1 = base * (1 - l.discount1_pct / 100);
    const afterDisc2 = afterDisc1 * (1 - l.discount2_pct / 100);
    const tax = afterDisc2 * (l.tax_rate / 100);
    subtotal += afterDisc2;
    taxTotal += tax;
    return { ...l, line_total: Math.round((afterDisc2 + tax) * 100) / 100 };
  });
  return { computed, subtotal: Math.round(subtotal * 100) / 100, taxTotal: Math.round(taxTotal * 100) / 100 };
}

export const upsertPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PoUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, lines, ...header } = data;
    const { computed, subtotal, taxTotal } = computeTotals(lines);
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    let poId: string;
    if (id) {
      poId = id;
      const { error } = await context.supabase
        .from("purchase_orders")
        .update({ ...header, subtotal, tax_total: taxTotal, total })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await context.supabase.from("purchase_order_lines").delete().eq("purchase_order_id", id);
    } else {
      // Sequential per-company/year numbering: PO-2026-00001
      const yr = new Date(header.order_date).getFullYear();
      const { count } = await context.supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", header.company_id)
        .gte("order_date", `${yr}-01-01`)
        .lte("order_date", `${yr}-12-31`);
      const poNumber = `PO-${yr}-${String((count ?? 0) + 1).padStart(5, "0")}`;

      const { data: created, error } = await context.supabase
        .from("purchase_orders")
        .insert({
          ...header,
          po_number: poNumber,
          status: "draft",
          subtotal,
          tax_total: taxTotal,
          total,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      poId = created.id;
    }

    const { error: linesErr } = await context.supabase.from("purchase_order_lines").insert(
      computed.map((l, i) => ({
        purchase_order_id: poId,
        product_id: l.product_id ?? null,
        description: l.description ?? null,
        quantity: l.quantity,
        uom_id: l.uom_id ?? null,
        unit_price: l.unit_price,
        bonus: l.bonus,
        discount1_pct: l.discount1_pct,
        discount2_pct: l.discount2_pct,
        tax_id: l.tax_id ?? null,
        tax_rate: l.tax_rate,
        line_total: l.line_total,
        sort_order: i,
      })),
    );
    if (linesErr) throw new Error(linesErr.message);

    return { id: poId };
  });

export const updatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "confirmed", "partially_received", "received", "cancelled"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("purchase_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("purchase_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
