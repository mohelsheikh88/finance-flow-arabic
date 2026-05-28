/**
 * Integration test: scoped-realtime cache invalidation.
 *
 * Verifies that postgres_changes events on context-affecting tables
 * (branches, companies, user_roles, user_branch_access, profiles) cause
 * the React-Query key ["user-context"] to be invalidated — which is what
 * causes the Topbar/Sidebar dropdowns to refresh without a manual reload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import React from "react";

type Handler = (payload: any) => void;

// vi.mock is hoisted — capture refs via vi.hoisted so the factory can see them.
const m = vi.hoisted(() => ({
  handlers: {} as Record<string, Handler[]>,
  subscribeMock: vi.fn(),
  removeChannelMock: vi.fn(),
  routerInvalidate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const channel = () => {
    const api: any = {
      on: (_event: string, opts: { table: string }, cb: Handler) => {
        (m.handlers[opts.table] ??= []).push(cb);
        return api;
      },
      subscribe: m.subscribeMock,
    };
    return api;
  };
  return {
    supabase: { channel, removeChannel: m.removeChannelMock },
  };
});

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: m.routerInvalidate }),
}));

// Import AFTER mocks so the hook resolves to mocked modules.
import { useScopedRealtime } from "@/lib/scoped-realtime";

function Harness({ roles }: { roles: string[] }) {
  useScopedRealtime({ userRoles: roles, companyId: "co-1", branchId: "br-1" });
  return null;
}

function mount(qc: QueryClient, roles: string[] = ["admin"]) {
  return render(
    <QueryClientProvider client={qc}>
      <Harness roles={roles} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  for (const k of Object.keys(m.handlers)) delete m.handlers[k];
  m.subscribeMock.mockClear();
  m.removeChannelMock.mockClear();
  m.routerInvalidate.mockClear();
});

function fire(
  table: string,
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: any
) {
  const hs = m.handlers[table] ?? [];
  expect(hs.length, `no handler registered for ${table}`).toBeGreaterThan(0);
  for (const h of hs) {
    h({
      eventType,
      new: eventType === "DELETE" ? null : row,
      old: eventType === "INSERT" ? null : row,
    });
  }
}

describe("scoped-realtime → user-context invalidation", () => {
  const contextTables = [
    "branches",
    "companies",
    "user_roles",
    "user_branch_access",
    "profiles",
  ] as const;

  it.each(contextTables)(
    "INSERT on %s invalidates the user-context query key",
    (table) => {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      qc.setQueryData(["user-context"], { roles: ["admin"] });
      const spy = vi.spyOn(qc, "invalidateQueries");

      mount(qc, ["admin"]);
      expect(m.subscribeMock).toHaveBeenCalled();

      fire(table, "INSERT", { id: "new-id" });

      const calls = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
      expect(calls).toContainEqual(["user-context"]);
      expect(calls).toContainEqual([table]);
    }
  );

  it.each(contextTables)(
    "UPDATE on %s invalidates the user-context query key + record key",
    (table) => {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const spy = vi.spyOn(qc, "invalidateQueries");

      mount(qc, ["admin"]);
      fire(table, "UPDATE", { id: "rec-1" });

      const calls = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
      expect(calls).toContainEqual(["user-context"]);
      expect(calls).toContainEqual([table, "rec-1"]);
    }
  );

  it.each(contextTables)(
    "DELETE on %s invalidates the user-context query key + record key",
    (table) => {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const spy = vi.spyOn(qc, "invalidateQueries");

      mount(qc, ["admin"]);
      fire(table, "DELETE", { id: "rec-1" });

      const calls = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
      expect(calls).toContainEqual(["user-context"]);
      expect(calls).toContainEqual([table, "rec-1"]);
    }
  );

  it("non-context table event does NOT invalidate user-context", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const spy = vi.spyOn(qc, "invalidateQueries");

    mount(qc, ["admin"]);
    fire("invoices", "INSERT", { id: "inv-1" });

    const calls = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(calls).toContainEqual(["invoices"]);
    expect(calls).not.toContainEqual(["user-context"]);
  });

  it("after invalidation, the next fetch returns fresh dropdown data", async () => {
    // End-to-end: realtime event → invalidate ["user-context"] → next fetch
    // returns updated branches (the source of the Topbar dropdown).
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    let serverBranches = [{ id: "br-1", name_en: "HQ" }];
    const refetcher = vi.fn(async () => ({
      roles: ["admin"],
      companies: [],
      branches: serverBranches,
    }));

    await qc.fetchQuery({ queryKey: ["user-context"], queryFn: refetcher });

    mount(qc, ["admin"]);

    serverBranches = [...serverBranches, { id: "br-2", name_en: "New Branch" }];
    fire("branches", "INSERT", { id: "br-2" });

    // Query is now stale — refetch returns fresh data.
    await qc.fetchQuery({ queryKey: ["user-context"], queryFn: refetcher });

    const data = qc.getQueryData<any>(["user-context"]);
    expect(data.branches.map((b: any) => b.id)).toEqual(["br-1", "br-2"]);
    expect(refetcher).toHaveBeenCalledTimes(2);
  });
});
