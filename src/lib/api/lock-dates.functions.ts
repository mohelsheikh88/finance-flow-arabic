import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

export const listLockDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("lock_dates")
      .select("*, branches(code, name_ar, name_en)")
      .eq("company_id", data.companyId)
      .order("lock_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateSchema = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  lock_date: z.string(),
  notes: z.string().max(500).optional().nullable(),
});

export const createLockDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lock_dates")
      .insert({ ...data, branch_id: data.branch_id || null, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  lock_date: z.string(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateLockDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("lock_dates")
      .update({ ...rest, branch_id: rest.branch_id || null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });


export const deleteLockDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lock_dates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Shared helper — call from server functions before inserting/posting financial txns. */
export async function assertNotLocked(
  supabase: SupabaseClient,
  companyId: string,
  branchId: string,
  txnDate: string,
) {
  const { data, error } = await supabase
    .from("lock_dates")
    .select("lock_date")
    .eq("company_id", companyId)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .gte("lock_date", txnDate)
    .order("lock_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    throw new Error(
      `Transaction date ${txnDate} is on or before the lock date ${data.lock_date}. Posting is not allowed.`,
    );
  }
}
