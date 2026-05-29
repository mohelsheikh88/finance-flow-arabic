import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = [
  "admin",
  "finance_manager",
  "accounting_manager",
  "chief_accountant",
  "accountant",
  "internal_auditor",
] as const;

export const listUsersWithRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string | null }) =>
    z.object({ companyId: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, display_name_ar, display_name_en, is_active")
      .order("display_name_en");
    if (error) throw new Error(error.message);

    let rolesQuery = supabase.from("user_roles").select("user_id, role, company_id");
    if (data.companyId) {
      rolesQuery = rolesQuery.or(`company_id.is.null,company_id.eq.${data.companyId}`);
    }
    const { data: roles, error: re } = await rolesQuery;
    if (re) throw new Error(re.message);

    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      if (!arr.includes(r.role)) arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  });

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
        companyId: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_roles").insert({
      user_id: data.userId,
      role: data.role,
      company_id: data.companyId,
      granted_by: userId,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
        companyId: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    q = data.companyId ? q.eq("company_id", data.companyId) : q.is("company_id", null);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
