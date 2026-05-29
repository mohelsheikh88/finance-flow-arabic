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

const MethodTypeEnum = z.enum(["cash", "bank_transfer", "check", "card", "other"]);

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  method_type: MethodTypeEnum,
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

const UpdateSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50).optional(),
  name_ar: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  method_type: MethodTypeEnum.optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  is_inbound: z.boolean().optional(),
  is_outbound: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const updatePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("payment_methods").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payment_methods").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SeedSchema = z.object({
  company_id: z.string().uuid(),
  codes: z.array(z.string()).min(1).max(100),
});

type PresetItem = {
  code: string;
  name_ar: string;
  name_en: string;
  method_type: z.infer<typeof MethodTypeEnum>;
  is_inbound: boolean;
  is_outbound: boolean;
  region: "saudi" | "global";
};

export const PAYMENT_METHOD_PRESETS: PresetItem[] = [
  // Saudi Arabia
  { code: "CASH", name_ar: "نقدًا", name_en: "Cash", method_type: "cash", is_inbound: true, is_outbound: true, region: "saudi" },
  { code: "MADA", name_ar: "مدى", name_en: "Mada", method_type: "card", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "MADA_ATM", name_ar: "مدى - صراف آلي", name_en: "Mada ATM", method_type: "card", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "STC_PAY", name_ar: "STC Pay", name_en: "STC Pay", method_type: "other", is_inbound: true, is_outbound: true, region: "saudi" },
  { code: "URPAY", name_ar: "urpay", name_en: "urpay", method_type: "other", is_inbound: true, is_outbound: true, region: "saudi" },
  { code: "APPLE_PAY", name_ar: "Apple Pay", name_en: "Apple Pay", method_type: "card", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "GOOGLE_PAY", name_ar: "Google Pay", name_en: "Google Pay", method_type: "card", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "SAMSUNG_PAY", name_ar: "Samsung Pay", name_en: "Samsung Pay", method_type: "card", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "SADAD", name_ar: "سداد", name_en: "SADAD", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "saudi" },
  { code: "BANK_TRANSFER_LOCAL", name_ar: "تحويل بنكي محلي", name_en: "Local Bank Transfer", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "saudi" },
  { code: "TAMARA", name_ar: "تمارا (قسّط)", name_en: "Tamara (BNPL)", method_type: "other", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "TABBY", name_ar: "تابي (قسّط)", name_en: "Tabby (BNPL)", method_type: "other", is_inbound: true, is_outbound: false, region: "saudi" },
  { code: "CHECK_LOCAL", name_ar: "شيك", name_en: "Cheque", method_type: "check", is_inbound: true, is_outbound: true, region: "saudi" },
  // Global
  { code: "VISA", name_ar: "فيزا", name_en: "Visa", method_type: "card", is_inbound: true, is_outbound: false, region: "global" },
  { code: "MASTERCARD", name_ar: "ماستركارد", name_en: "Mastercard", method_type: "card", is_inbound: true, is_outbound: false, region: "global" },
  { code: "AMEX", name_ar: "أمريكان إكسبريس", name_en: "American Express", method_type: "card", is_inbound: true, is_outbound: false, region: "global" },
  { code: "PAYPAL", name_ar: "باي بال", name_en: "PayPal", method_type: "other", is_inbound: true, is_outbound: true, region: "global" },
  { code: "STRIPE", name_ar: "Stripe", name_en: "Stripe", method_type: "other", is_inbound: true, is_outbound: false, region: "global" },
  { code: "WIRE_TRANSFER", name_ar: "تحويل بنكي دولي", name_en: "Wire Transfer", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "global" },
  { code: "SWIFT", name_ar: "SWIFT", name_en: "SWIFT", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "global" },
  { code: "ACH", name_ar: "ACH (الولايات المتحدة)", name_en: "ACH (US)", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "global" },
  { code: "SEPA", name_ar: "SEPA (أوروبا)", name_en: "SEPA (EU)", method_type: "bank_transfer", is_inbound: true, is_outbound: true, region: "global" },
  { code: "WESTERN_UNION", name_ar: "ويسترن يونيون", name_en: "Western Union", method_type: "other", is_inbound: true, is_outbound: true, region: "global" },
  { code: "MONEYGRAM", name_ar: "MoneyGram", name_en: "MoneyGram", method_type: "other", is_inbound: true, is_outbound: true, region: "global" },
  { code: "CRYPTO", name_ar: "عملات رقمية", name_en: "Cryptocurrency", method_type: "other", is_inbound: true, is_outbound: true, region: "global" },
  { code: "COD", name_ar: "الدفع عند الاستلام", name_en: "Cash on Delivery", method_type: "cash", is_inbound: true, is_outbound: false, region: "global" },
];

export const seedPaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SeedSchema.parse(i))
  .handler(async ({ data, context }) => {
    const presets = PAYMENT_METHOD_PRESETS.filter((p) => data.codes.includes(p.code));
    if (presets.length === 0) return { inserted: 0 };

    const { data: existing } = await context.supabase
      .from("payment_methods")
      .select("code")
      .eq("company_id", data.company_id)
      .in("code", presets.map((p) => p.code));
    const existingCodes = new Set((existing ?? []).map((r: any) => r.code));
    const toInsert = presets
      .filter((p) => !existingCodes.has(p.code))
      .map((p) => ({
        company_id: data.company_id,
        code: p.code,
        name_ar: p.name_ar,
        name_en: p.name_en,
        method_type: p.method_type,
        is_inbound: p.is_inbound,
        is_outbound: p.is_outbound,
        is_active: true,
      }));
    if (toInsert.length === 0) return { inserted: 0 };
    const { error } = await context.supabase.from("payment_methods").insert(toInsert);
    if (error) throw new Error(error.message);
    return { inserted: toInsert.length };
  });
