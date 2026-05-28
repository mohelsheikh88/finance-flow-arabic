import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListSchema = z.object({
  tableName: z.string().optional().nullable(),
  action: z.enum(["INSERT", "UPDATE", "DELETE"]).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  recordId: z.string().uuid().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden: admin only");

    let q = supabase
      .from("audit_log")
      .select("id, table_name, record_id, action, user_id, changed_at, old_data, new_data")
      .order("changed_at", { ascending: false })
      .limit(data.limit);

    if (data.tableName) q = q.eq("table_name", data.tableName);
    if (data.action) q = q.eq("action", data.action);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.recordId) q = q.eq("record_id", data.recordId);
    if (data.from) q = q.gte("changed_at", data.from);
    if (data.to) q = q.lte("changed_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
    let profilesById: Record<string, { display_name_ar: string | null; display_name_en: string | null; email: string }> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, display_name_ar, display_name_en")
        .in("id", ids);
      profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }

    return (rows ?? []).map((r) => ({
      ...r,
      user: r.user_id ? profilesById[r.user_id] ?? null : null,
    }));
  });

export const listAuditTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden: admin only");

    const { data, error } = await supabase
      .from("audit_log")
      .select("table_name")
      .order("table_name");
    if (error) throw new Error(error.message);
    return Array.from(new Set((data ?? []).map((r: any) => r.table_name))).sort();
  });
