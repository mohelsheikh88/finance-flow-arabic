import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Only administrators can manage companies & branches.");
  }
}

export const listCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name_en");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("branches").select("*");
    if (data.companyId) q = q.eq("company_id", data.companyId);
    const { data: rows, error } = await q
      .order("is_main", { ascending: false })
      .order("name_en");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CompanySchema = z.object({
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  vat_number: z.string().max(50).optional().nullable(),
  cr_number: z.string().max(50).optional().nullable(),
  address_ar: z.string().max(500).optional().nullable(),
  address_en: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  website: z.string().max(255).optional().nullable(),
  default_currency: z.string().length(3).default("SAR"),
  fiscal_year_start_month: z.number().int().min(1).max(12).default(1),
});

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CompanySchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert({ ...data, email: data.email || null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).merge(CompanySchema.partial()).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .update({ ...patch, email: patch.email || null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const BranchSchema = z.object({
  company_id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  address_ar: z.string().max(500).optional().nullable(),
  address_en: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  is_main: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const createBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BranchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("branches")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Grant the admin access to this branch too
    await supabaseAdmin
      .from("user_branch_access")
      .insert({ user_id: context.userId, branch_id: row.id })
      .select();
    return row;
  });

export const updateBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).merge(BranchSchema.partial()).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabaseAdmin
      .from("branches")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
