import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPaymentMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("payment_methods")
      .select("*, bank_accounts(code, name_ar, name_en)")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  method_type: z.enum(["cash", "bank_transfer", "check", "card", "other"]),
  bank_account_id: z.string().uuid().optional().nullable(),
  is_inbound: z.boolean().default(true),
  is_outbound: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

export const createPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_methods")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_active?: boolean; name_ar?: string; name_en?: string; is_inbound?: boolean; is_outbound?: boolean; bank_account_id?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("payment_methods").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
