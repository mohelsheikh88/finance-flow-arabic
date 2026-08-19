import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";
import { employeeIdToAuthEmail } from "@/lib/employee-auth";

const APP_ROLES = [
  "admin",
  "finance_manager",
  "accounting_manager",
  "chief_accountant",
  "accountant",
  "internal_auditor",
  "internal_audit_manager",
  "his_admin",
  "accounting_admin",
] as const;

// Company ids can be stale (e.g. coming from a previous backend). Only keep
// the id when the company actually exists, otherwise fall back to a global role.
async function resolveCompanyId(supabase: any, companyId: string | null) {
  if (!companyId) return null;
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  return data?.id ?? null;
}

export const listUsersWithRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string | null }) =>
    z.object({ companyId: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, employee_id, display_name_ar, display_name_en, is_active")
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
    const companyId = await resolveCompanyId(supabase, data.companyId);
    const { error } = await supabase.from("user_roles").insert({
      user_id: data.userId,
      role: data.role,
      company_id: companyId,
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

// ---------------------------------------------------------------------------
// Admin user management (create / update / disable / delete) + module access
// ---------------------------------------------------------------------------

// Module keys are open-ended (new modules get added regularly), so we
// validate them as plain non-empty strings rather than a fixed enum that
// would silently reject anything added after this list was written.
const moduleKeySchema = z.string().min(1);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only administrators can manage users");
}

export const listModuleAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_module_access")
      .select("user_id, module_key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listUserBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_branch_access")
      .select("user_id, branch_id, can_read, can_write, can_edit, can_delete");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const BranchPermSchema = z.object({
  branchId: z.string().uuid(),
  canRead: z.boolean().default(true),
  canWrite: z.boolean().default(true),
  canEdit: z.boolean().default(true),
  canDelete: z.boolean().default(true),
});

export const setUserBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        branches: z.array(BranchPermSchema),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.self.server");
    const { error: de } = await supabaseAdmin
      .from("user_branch_access")
      .delete()
      .eq("user_id", data.userId);
    if (de) throw new Error(de.message);
    if (data.branches.length) {
      const { error: ie } = await supabaseAdmin.from("user_branch_access").insert(
        data.branches.map((b) => ({
          user_id: data.userId,
          branch_id: b.branchId,
          can_read: b.canRead,
          can_write: b.canWrite,
          can_edit: b.canEdit,
          can_delete: b.canDelete,
        })),
      );
      if (ie) throw new Error(ie.message);
    }
    return { ok: true };
  });

export const setUserModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        modules: z.array(moduleKeySchema),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.self.server");
    const { error: de } = await supabaseAdmin
      .from("user_module_access")
      .delete()
      .eq("user_id", data.userId);
    if (de) throw new Error(de.message);
    if (data.modules.length) {
      const { error: ie } = await supabaseAdmin.from("user_module_access").insert(
        data.modules.map((m) => ({
          user_id: data.userId,
          module_key: m,
          granted_by: context.userId,
        })),
      );
      if (ie) throw new Error(ie.message);
    }
    return { ok: true };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        employeeId: z.string().min(1),
        contactEmail: z.string().email().nullable().optional(),
        password: z.string().min(8),
        displayNameAr: z.string().min(1),
        displayNameEn: z.string().min(1),
        roles: z.array(z.string()).default([]),
        modules: z.array(moduleKeySchema).default([]),
        companyId: z.string().uuid().nullable().default(null),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.self.server");

    // Uniqueness check up front so we fail with a clear message instead of
    // a raw Postgres unique-constraint error.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("employee_id", data.employeeId)
      .maybeSingle();
    if (existing) throw new Error("Employee ID already in use");

    const authEmail = employeeIdToAuthEmail(data.employeeId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name_ar: data.displayNameAr,
        display_name_en: data.displayNameEn,
        employee_id: data.employeeId,
      },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;

    await supabaseAdmin
      .from("profiles")
      .update({
        display_name_ar: data.displayNameAr,
        display_name_en: data.displayNameEn,
        employee_id: data.employeeId,
        email: data.contactEmail || authEmail,
      })
      .eq("id", newId);

    if (data.roles.length) {
      const companyId = await resolveCompanyId(supabaseAdmin, data.companyId);
      await supabaseAdmin.from("user_roles").insert(
        data.roles.map((r) => ({
          user_id: newId,
          role: r as any,
          company_id: companyId,
          granted_by: context.userId,
        })),
      );
    }

    if (data.modules.length) {
      await supabaseAdmin.from("user_module_access").insert(
        data.modules.map((m) => ({
          user_id: newId,
          module_key: m,
          granted_by: context.userId,
        })),
      );
    }
    return { id: newId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        userId: z.string().uuid(),
        displayNameAr: z.string().min(1).optional(),
        displayNameEn: z.string().min(1).optional(),
        employeeId: z.string().min(1).optional(),
        contactEmail: z.string().email().nullable().optional(),
        password: z.string().min(8).optional().nullable(),
        isActive: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.self.server");

    if (data.employeeId !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("employee_id", data.employeeId)
        .neq("id", data.userId)
        .maybeSingle();
      if (existing) throw new Error("Employee ID already in use");
    }

    const patch: {
      display_name_ar?: string;
      display_name_en?: string;
      is_active?: boolean;
      employee_id?: string;
      email?: string;
    } = {};
    if (data.displayNameAr !== undefined) patch.display_name_ar = data.displayNameAr;
    if (data.displayNameEn !== undefined) patch.display_name_en = data.displayNameEn;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.employeeId !== undefined) patch.employee_id = data.employeeId;
    if (data.contactEmail !== undefined) patch.email = data.contactEmail || employeeIdToAuthEmail(data.employeeId ?? "");
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    // Changing the Employee ID also has to move the underlying auth
    // identity, since that's what login is keyed on.
    if (data.employeeId !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: employeeIdToAuthEmail(data.employeeId),
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }

    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }

    if (data.isActive !== undefined) {
      // banning blocks sign-in for disabled users
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.isActive ? "none" : "876000h",
      } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/admin.self.server");

    // Remove every application-level record first. This also repairs users whose
    // auth account was removed by an earlier, partially completed deletion.
    const { error: moduleError } = await supabaseAdmin
      .from("user_module_access")
      .delete()
      .eq("user_id", data.userId);
    if (moduleError) throw new Error(moduleError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (roleError) throw new Error(roleError.message);

    const { error: branchError } = await supabaseAdmin
      .from("user_branch_access")
      .delete()
      .eq("user_id", data.userId);
    if (branchError) throw new Error(branchError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    // Deletion is intentionally idempotent: a missing auth account means the
    // desired final state has already been reached.
    if (authError && !authError.message.toLowerCase().includes("user not found")) {
      throw new Error(authError.message);
    }
    return { ok: true };
  });

