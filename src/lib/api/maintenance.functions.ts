import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

// Runs server-side daily maintenance for the current user/company.
// Extend this handler with real ops (e.g. FX rate sync, depreciation,
// recurring entries posting, etc.). For now it performs a lightweight
// "touch" so we have a hook to grow into.
export const runDailyMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      companyId: z.string().uuid().nullable().optional(),
      day: z.string().min(8).max(10), // YYYY-MM-DD
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startedAt = Date.now();

    // Placeholder workload — kept fast & safe. Add real daily jobs here.
    // Example reads that confirm the connection works under user RLS:
    if (data.companyId) {
      await supabase
        .from("companies")
        .select("id")
        .eq("id", data.companyId)
        .limit(1);
    }

    return {
      ok: true as const,
      userId,
      day: data.day,
      durationMs: Date.now() - startedAt,
    };
  });
