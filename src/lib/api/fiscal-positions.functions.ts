import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

export const listFiscalPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("fiscal_positions")
      .select("*")
      .eq("company_id", data.companyId)
      .order("name_ar");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  is_saudi: z.boolean().default(true),
  vat_applicable: z.boolean().default(true),
  zakat_applicable: z.boolean().default(true),
  income_tax_applicable: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const createFiscalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("fiscal_positions")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateFiscalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_active?: boolean; name_ar?: string; name_en?: string; is_saudi?: boolean; vat_applicable?: boolean; zakat_applicable?: boolean; income_tax_applicable?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("fiscal_positions").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFiscalPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fiscal_positions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
