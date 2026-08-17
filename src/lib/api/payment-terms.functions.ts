import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

export const listPaymentTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("payment_terms")
      .select("*")
      .eq("company_id", data.companyId)
      .order("days");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  days: z.number().int().min(0).max(3650),
  is_active: z.boolean().default(true),
});

export const createPaymentTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_terms")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name_ar: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  days: z.number().int().min(0).max(3650).optional(),
  is_active: z.boolean().optional(),
});

export const updatePaymentTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("payment_terms").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payment_terms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PaymentTermPreset = { name_ar: string; name_en: string; days: number };

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  { name_ar: "نقدي / فوري", name_en: "Immediate / Cash", days: 0 },
  { name_ar: "صافي 7 أيام", name_en: "Net 7", days: 7 },
  { name_ar: "صافي 10 أيام", name_en: "Net 10", days: 10 },
  { name_ar: "صافي 14 يوم", name_en: "Net 14", days: 14 },
  { name_ar: "صافي 15 يوم", name_en: "Net 15", days: 15 },
  { name_ar: "صافي 21 يوم", name_en: "Net 21", days: 21 },
  { name_ar: "صافي 30 يوم", name_en: "Net 30", days: 30 },
  { name_ar: "صافي 45 يوم", name_en: "Net 45", days: 45 },
  { name_ar: "صافي 60 يوم", name_en: "Net 60", days: 60 },
  { name_ar: "صافي 75 يوم", name_en: "Net 75", days: 75 },
  { name_ar: "صافي 90 يوم", name_en: "Net 90", days: 90 },
  { name_ar: "صافي 120 يوم", name_en: "Net 120", days: 120 },
  { name_ar: "صافي 180 يوم", name_en: "Net 180", days: 180 },
  { name_ar: "صافي 365 يوم", name_en: "Net 365", days: 365 },
];

const SeedSchema = z.object({
  company_id: z.string().uuid(),
  days_list: z.array(z.number().int().min(0).max(3650)).min(1).max(50),
});

export const seedPaymentTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SeedSchema.parse(i))
  .handler(async ({ data, context }) => {
    const presets = PAYMENT_TERM_PRESETS.filter((p) => data.days_list.includes(p.days));
    if (presets.length === 0) return { inserted: 0 };

    const { data: existing } = await context.supabase
      .from("payment_terms")
      .select("days")
      .eq("company_id", data.company_id)
      .in("days", presets.map((p) => p.days));
    const existingDays = new Set((existing ?? []).map((r: any) => r.days));
    const toInsert = presets
      .filter((p) => !existingDays.has(p.days))
      .map((p) => ({
        company_id: data.company_id,
        name_ar: p.name_ar,
        name_en: p.name_en,
        days: p.days,
        is_active: true,
      }));
    if (toInsert.length === 0) return { inserted: 0 };
    const { error } = await context.supabase.from("payment_terms").insert(toInsert);
    if (error) throw new Error(error.message);
    return { inserted: toInsert.length };
  });
