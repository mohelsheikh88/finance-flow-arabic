import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listBankAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("bank_accounts")
      .select("*, accounts:gl_account_id(code, name_ar, name_en), journals:journal_id(code, name_ar, name_en)")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateBankSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  bank_name: z.string().min(1).max(255),
  account_number: z.string().max(100).optional().nullable(),
  iban: z.string().max(50).optional().nullable(),
  swift_code: z.string().max(20).optional().nullable(),
  currency_code: z.string().min(3).max(3).default("SAR"),
  gl_account_id: z.string().uuid().optional().nullable(),
  journal_id: z.string().uuid().optional().nullable(),
});

export const createBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateBankSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bank_accounts")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getBankBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; glAccountId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("journal_entry_lines")
      .select("debit, credit, journal_entries!inner(status, company_id)")
      .eq("account_id", data.glAccountId)
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  });
