import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(10)
  .regex(/^[A-Z0-9]+$/);

// ---------------- Currencies (global master) ----------------
export const listCurrencies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("currencies")
      .select("*")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const UpsertSchema = z.object({
  code: CodeSchema,
  name_ar: z.string().trim().min(1).max(255),
  name_en: z.string().trim().min(1).max(255),
  symbol: z.string().trim().max(10).optional().nullable(),
  decimals: z.number().int().min(0).max(8).default(2),
  is_active: z.boolean().default(true),
});

export const createCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("currencies")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateSchema = z.object({
  code: CodeSchema,
  name_ar: z.string().trim().min(1).max(255).optional(),
  name_en: z.string().trim().min(1).max(255).optional(),
  symbol: z.string().trim().max(10).optional().nullable(),
  decimals: z.number().int().min(0).max(8).optional(),
  is_active: z.boolean().optional(),
});

export const updateCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { code, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("currencies")
      .update(patch)
      .eq("code", code)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string }) => ({ code: CodeSchema.parse(i.code) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Block deletion if referenced
    const checks = await Promise.all([
      sb.from("accounts").select("id", { count: "exact", head: true }).eq("currency_code", data.code),
      sb.from("bank_accounts").select("id", { count: "exact", head: true }).eq("currency_code", data.code),
      sb.from("invoices").select("id", { count: "exact", head: true }).eq("currency_code", data.code),
      sb.from("payments").select("id", { count: "exact", head: true }).eq("currency_code", data.code),
      sb.from("journal_entries").select("id", { count: "exact", head: true }).eq("currency_code", data.code),
    ]);
    const used = checks.reduce((sum, r) => sum + (r.count ?? 0), 0);
    if (used > 0) {
      throw new Error(`Currency is in use (${used} references). Deactivate it instead of deleting.`);
    }
    const { error } = await context.supabase.from("currencies").delete().eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Exchange Rates (per company) ----------------
export const listExchangeRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; currencyCode?: string }) => i)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("exchange_rates")
      .select("*")
      .eq("company_id", data.companyId)
      .order("rate_date", { ascending: false });
    if (data.currencyCode) q = q.eq("currency_code", data.currencyCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const RateSchema = z.object({
  company_id: z.string().uuid(),
  currency_code: CodeSchema,
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.number().positive().max(1_000_000),
});

export const upsertExchangeRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RateSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Remove existing for same (company, currency, date) then insert
    await context.supabase
      .from("exchange_rates")
      .delete()
      .eq("company_id", data.company_id)
      .eq("currency_code", data.currency_code)
      .eq("rate_date", data.rate_date);
    const { data: row, error } = await context.supabase
      .from("exchange_rates")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExchangeRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("exchange_rates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
