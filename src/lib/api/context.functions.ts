import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUserContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, rolesRes, companiesRes, branchesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, company_id").eq("user_id", userId),
      supabase.from("companies").select("*").order("name_en"),
      supabase.from("branches").select("*").order("created_at", { ascending: true }),
    ]);

    return {
      profile: profileRes.data,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      companies: companiesRes.data ?? [],
      branches: branchesRes.data ?? [],
      isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
    };
  });
