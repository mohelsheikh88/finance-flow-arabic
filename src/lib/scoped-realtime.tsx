import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth/AuthProvider";

type Scope =
  | { kind: "branch" }
  | { kind: "company" }
  | { kind: "shared" }
  | { kind: "admin" }
  | { kind: "child"; parentTable: string };

type TableConfig = {
  scope: Scope;
  /** roles allowed; empty = any authenticated. "admin" always granted. */
  roles?: string[];
};

const FINANCE = [
  "admin",
  "finance_manager",
  "accounting_manager",
  "chief_accountant",
  "accountant",
];
const FINANCE_MGR = ["admin", "finance_manager", "accounting_manager"];

/**
 * Maps each public table to its scoping rule + required roles.
 * Tables not listed are skipped (no realtime sub created).
 */
const TABLES: Record<string, TableConfig> = {
  // Company-scoped masters
  accounts: { scope: { kind: "company" }, roles: FINANCE },
  journals: { scope: { kind: "company" }, roles: FINANCE_MGR },
  partners: { scope: { kind: "company" }, roles: FINANCE },
  taxes: { scope: { kind: "company" }, roles: FINANCE_MGR },
  fiscal_periods: { scope: { kind: "company" }, roles: FINANCE_MGR },
  exchange_rates: { scope: { kind: "company" }, roles: FINANCE_MGR },
  bank_accounts: { scope: { kind: "company" }, roles: FINANCE_MGR },
  payment_methods: { scope: { kind: "company" }, roles: FINANCE_MGR },
  payment_terms: { scope: { kind: "company" }, roles: FINANCE_MGR },
  asset_categories: { scope: { kind: "company" }, roles: FINANCE_MGR },
  cost_centers: { scope: { kind: "company" }, roles: FINANCE },
  approval_workflows: { scope: { kind: "company" }, roles: FINANCE_MGR },
  lock_dates: { scope: { kind: "company" }, roles: FINANCE_MGR },
  companies: { scope: { kind: "company" } },

  // Branch-scoped transactions
  invoices: { scope: { kind: "branch" }, roles: FINANCE },
  payments: { scope: { kind: "branch" }, roles: FINANCE },
  journal_entries: { scope: { kind: "branch" }, roles: FINANCE },
  fixed_assets: { scope: { kind: "branch" }, roles: FINANCE },
  approval_requests: { scope: { kind: "branch" } },
  branches: { scope: { kind: "branch" } },

  // Children — listen globally but key invalidation by table only
  invoice_lines: { scope: { kind: "child", parentTable: "invoices" }, roles: FINANCE },
  journal_entry_lines: { scope: { kind: "child", parentTable: "journal_entries" }, roles: FINANCE },
  payment_allocations: { scope: { kind: "child", parentTable: "payments" }, roles: FINANCE },
  approval_actions: { scope: { kind: "child", parentTable: "approval_requests" } },
  approval_steps_def: { scope: { kind: "child", parentTable: "approval_workflows" }, roles: FINANCE_MGR },
  asset_disposals: { scope: { kind: "child", parentTable: "fixed_assets" }, roles: FINANCE_MGR },
  depreciation_schedule: { scope: { kind: "child", parentTable: "fixed_assets" }, roles: FINANCE },

  // Shared reference
  currencies: { scope: { kind: "shared" } },

  // Admin only
  audit_log: { scope: { kind: "admin" } },
  user_roles: { scope: { kind: "admin" } },
  user_branch_access: { scope: { kind: "admin" } },
  profiles: { scope: { kind: "admin" } },
};

function hasAnyRole(userRoles: string[], required?: string[]) {
  if (!required || required.length === 0) return true;
  if (userRoles.includes("admin")) return true;
  return required.some((r) => userRoles.includes(r));
}

/**
 * Subscribes to Realtime updates ONLY for tables the current user is
 * authorized to see, scoped to their active branch / company.
 *
 * - Branch-scoped tables: filter by branch_id=eq.<activeBranchId>
 * - Company-scoped tables: filter by company_id=eq.<activeCompanyId>
 * - Child tables: subscribe without filter (RLS still filters on server)
 * - Admin tables: only subscribed for admin role
 * - Shared tables: subscribed for everyone
 *
 * Cache invalidation is keyed by table (and event/id) — never global.
 */
export function useScopedRealtime(opts: {
  userRoles: string[];
  companyId: string | null;
  branchId: string | null;
}) {
  const { userRoles, companyId, branchId } = opts;
  const queryClient = useQueryClient();
  const router = useRouter();
  const isAdmin = userRoles.includes("admin");

  // Build list of (table, filter) pairs based on permissions + active scope
  const subs = useMemo(() => {
    const result: { table: string; filter?: string }[] = [];
    for (const [table, cfg] of Object.entries(TABLES)) {
      if (!hasAnyRole(userRoles, cfg.roles)) continue;

      switch (cfg.scope.kind) {
        case "admin":
          if (isAdmin) result.push({ table });
          break;
        case "shared":
          result.push({ table });
          break;
        case "company":
          if (companyId) result.push({ table, filter: `company_id=eq.${companyId}` });
          break;
        case "branch":
          if (branchId) result.push({ table, filter: `branch_id=eq.${branchId}` });
          break;
        case "child":
          result.push({ table }); // RLS-filtered on server
          break;
      }
    }
    return result;
  }, [userRoles, companyId, branchId, isAdmin]);

  useEffect(() => {
    if (subs.length === 0) return;

    const channel = supabase.channel(
      `scoped-rt:${companyId ?? "_"}:${branchId ?? "_"}:${userRoles.join(",")}`
    );

    for (const { table, filter } of subs) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) } as never,
        (payload: any) => {
          const event = payload.eventType;
          // Targeted invalidation: by table, by table+event, and by record id
          queryClient.invalidateQueries({ queryKey: [table] });
          queryClient.invalidateQueries({ queryKey: [table, event] });
          const rec = payload.new ?? payload.old;
          if (rec?.id && (event === "UPDATE" || event === "DELETE")) {
            queryClient.invalidateQueries({ queryKey: [table, rec.id] });
          }
          // If this is a child row, also invalidate the parent table cache
          const cfg = TABLES[table];
          if (cfg?.scope.kind === "child") {
            queryClient.invalidateQueries({ queryKey: [cfg.scope.parentTable] });
          }
          // Refresh active route loaders (cheap; router-side dedup applies)
          router.invalidate();
        }
      );
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [subs, companyId, branchId, queryClient, router, userRoles]);
}

/** Convenience wrapper used in __root.tsx — reads current user/branch automatically. */
export function ScopedRealtime() {
  const { user } = useAuth();
  const { companyId, branchId } = useBranch();
  const queryClient = useQueryClient();

  // Read roles from the cached user-context query (populated by Topbar).
  const ctx = queryClient.getQueryData<{ roles?: string[]; isAdmin?: boolean }>([
    "user-context",
  ]);
  const roles = ctx?.roles ?? [];

  useScopedRealtime({
    userRoles: user ? roles : [],
    companyId,
    branchId,
  });

  return null;
}
