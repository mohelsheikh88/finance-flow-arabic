import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type EditEntry = {
  table: string;
  id: string;
  updatedAt: string | null;
  onConflict: (payload: { newUpdatedAt: string | null; changedBy: string | null }) => void;
};

type Ctx = {
  register: (key: string, entry: EditEntry) => void;
  unregister: (key: string) => void;
  getEntries: () => Map<string, EditEntry>;
};

const ConflictCtx = createContext<Ctx | null>(null);

export function ConflictTrackerProvider({ children }: { children: React.ReactNode }) {
  const entriesRef = useRef<Map<string, EditEntry>>(new Map());

  const register = useCallback((key: string, entry: EditEntry) => {
    entriesRef.current.set(key, entry);
  }, []);
  const unregister = useCallback((key: string) => {
    entriesRef.current.delete(key);
  }, []);
  const getEntries = useCallback(() => entriesRef.current, []);

  const value = useMemo<Ctx>(() => ({ register, unregister, getEntries }), [register, unregister, getEntries]);

  return <ConflictCtx.Provider value={value}>{children}</ConflictCtx.Provider>;
}

export function useConflictTracker() {
  const ctx = useContext(ConflictCtx);
  if (!ctx) throw new Error("useConflictTracker must be used inside ConflictTrackerProvider");
  return ctx;
}

/**
 * Track a record being edited locally. If realtime detects another user
 * updating this row, `onConflict` fires.
 */
export function useTrackEditing(opts: {
  table: string;
  id: string | null | undefined;
  updatedAt: string | null | undefined;
  onConflict: (info: { newUpdatedAt: string | null; changedBy: string | null }) => void;
  enabled?: boolean;
}) {
  const { register, unregister } = useConflictTracker();
  const onConflictRef = useRef(opts.onConflict);
  useEffect(() => { onConflictRef.current = opts.onConflict; }, [opts.onConflict]);

  useEffect(() => {
    if (!opts.enabled || !opts.id) return;
    const key = `${opts.table}:${opts.id}`;
    register(key, {
      table: opts.table,
      id: opts.id,
      updatedAt: opts.updatedAt ?? null,
      onConflict: (p) => onConflictRef.current(p),
    });
    return () => unregister(key);
  }, [opts.table, opts.id, opts.updatedAt, opts.enabled, register, unregister]);
}

/** Internal: feed realtime payloads here to detect conflicts. */
export function useConflictRealtimeSubscriber() {
  const { getEntries } = useConflictTracker();
  useEffect(() => {
    const channel = supabase
      .channel("conflict-detection")
      .on("postgres_changes", { event: "UPDATE", schema: "public" }, async (payload: any) => {
        const table = payload.table as string;
        const newRow = payload.new as Record<string, any> | null;
        if (!newRow?.id) return;
        const key = `${table}:${newRow.id}`;
        const entry = getEntries().get(key);
        if (!entry) return;

        const newUpdatedAt: string | null = newRow.updated_at ?? null;
        // If the update is exactly the one the local form just wrote, skip.
        if (entry.updatedAt && newUpdatedAt && entry.updatedAt === newUpdatedAt) return;

        // Determine current user; if they performed the update themselves, skip.
        const { data: { user } } = await supabase.auth.getUser();
        const changedBy =
          (newRow.updated_by as string | undefined) ??
          (newRow.posted_by as string | undefined) ??
          (newRow.cancelled_by as string | undefined) ??
          null;
        if (changedBy && user?.id && changedBy === user.id) return;

        entry.onConflict({ newUpdatedAt, changedBy });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [getEntries]);
}
