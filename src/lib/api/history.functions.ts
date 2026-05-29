import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  table: z.enum([
    "journal_entries",
    "invoices",
    "payments",
    "fixed_assets",
  ]),
  recordId: z.string().uuid(),
});

// Lookup branch_id of the parent record so we can authorize via has_branch_access
async function getBranchId(table: string, id: string): Promise<string | null> {
  const { data } = await (supabaseAdmin as any)
    .from(table)
    .select("branch_id")
    .eq("id", id)
    .maybeSingle();
  return (data as any)?.branch_id ?? null;
}

const CHILD_MAP: Record<string, { table: string; parentField: string } | null> = {
  journal_entries: { table: "journal_entry_lines", parentField: "entry_id" },
  invoices: { table: "invoice_lines", parentField: "invoice_id" },
  payments: { table: "payment_allocations", parentField: "payment_id" },
  fixed_assets: { table: "asset_disposals", parentField: "asset_id" },
};

export const getRecordHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Schema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: confirm user can read the parent record (RLS handles it)
    const branchId = await getBranchId(data.table, data.recordId);
    if (!branchId) throw new Error("RECORD_NOT_FOUND");
    const { data: ok } = await supabase.rpc("has_branch_access", {
      _user_id: userId,
      _branch_id: branchId,
    });
    if (!ok) throw new Error("FORBIDDEN");

    // Collect child line IDs (via admin to bypass RLS uniformly)
    const child = CHILD_MAP[data.table];
    let childIds: string[] = [];
    if (child) {
      const { data: kids } = await (supabaseAdmin as any)
        .from(child.table)
        .select("id")
        .eq(child.parentField, data.recordId);
      childIds = (kids ?? []).map((r: any) => r.id);
    }

    // Fetch audit log rows
    const orFilters: string[] = [
      `and(table_name.eq.${data.table},record_id.eq.${data.recordId})`,
    ];
    if (child && childIds.length > 0) {
      orFilters.push(
        `and(table_name.eq.${child.table},record_id.in.(${childIds.join(",")}))`,
      );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, table_name, record_id, action, user_id, changed_at, old_data, new_data")
      .or(orFilters.join(","))
      .order("changed_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    // Enrich with user display names
    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]),
    );
    let profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email, display_name_ar, display_name_en")
        .in("id", userIds);
      profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }

    return (rows ?? []).map((r) => ({
      ...r,
      user: r.user_id ? profilesById[r.user_id] ?? null : null,
    }));
  });
