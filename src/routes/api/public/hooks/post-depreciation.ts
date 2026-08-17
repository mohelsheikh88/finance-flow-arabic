import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/admin.self.server";
import { postDueDepreciationCore } from "@/lib/api/assets.functions";

/**
 * Public cron endpoint. Called monthly by pg_cron to post any
 * unposted depreciation schedule rows whose period_date <= today.
 *
 * Authenticated via the Supabase anon `apikey` header — `/api/public/*`
 * bypasses the platform auth wall, and this handler additionally checks
 * the apikey to reject random callers.
 */
export const Route = createFileRoute("/api/public/hooks/post-depreciation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        let body: any = {};
        try { body = await request.json(); } catch { /* allow empty */ }

        try {
          const result = await postDueDepreciationCore(supabaseAdmin, null, {
            companyId: body.companyId,
            asOf: body.asOf,
          });
          return new Response(JSON.stringify({ success: true, ...result }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[post-depreciation] error", e);
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
