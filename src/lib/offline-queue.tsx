import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "offline_queue_v1";

export type QueuedOp = {
  id: string;
  table: string;
  op: "insert" | "update" | "delete" | "upsert";
  payload?: Record<string, unknown> | Record<string, unknown>[];
  match?: Record<string, unknown>;
  createdAt: number;
  retries: number;
  lastError?: string;
};

type Ctx = {
  online: boolean;
  queue: QueuedOp[];
  enqueue: (op: Omit<QueuedOp, "id" | "createdAt" | "retries">) => string;
  flush: () => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  syncing: boolean;
};

const OfflineCtx = createContext<Ctx | null>(null);

function load(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(q: QueuedOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedOp[]>(() => load());
  const [syncing, setSyncing] = useState(false);

  // Persist queue
  useEffect(() => {
    save(queue);
  }, [queue]);

  // Online/offline listeners
  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => {
      setOnline(true);
      toast.success("عاد الاتصال — جاري المزامنة...");
    };
    const goOffline = () => {
      setOnline(false);
      toast.warning("أنت غير متصل — سيتم حفظ التغييرات محلياً");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const remove = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  const enqueue: Ctx["enqueue"] = useCallback((op) => {
    const id = crypto.randomUUID();
    const item: QueuedOp = { ...op, id, createdAt: Date.now(), retries: 0 };
    setQueue((q) => [...q, item]);
    toast.info(`تم حفظ العملية محلياً (${op.table})`);
    return id;
  }, []);

  const runOne = useCallback(async (item: QueuedOp): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const table = supabase.from(item.table as never);
      let res;
      if (item.op === "insert") {
        res = await (table as any).insert(item.payload);
      } else if (item.op === "upsert") {
        res = await (table as any).upsert(item.payload);
      } else if (item.op === "update") {
        let q = (table as any).update(item.payload);
        for (const [k, v] of Object.entries(item.match || {})) q = q.eq(k, v);
        res = await q;
      } else {
        let q = (table as any).delete();
        for (const [k, v] of Object.entries(item.match || {})) q = q.eq(k, v);
        res = await q;
      }
      if (res?.error) return { ok: false, error: res.error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Unknown error" };
    }
  }, []);

  const flush = useCallback(async () => {
    if (syncing) return;
    const current = load();
    if (current.length === 0) return;
    setSyncing(true);
    let successCount = 0;
    let failed: QueuedOp[] = [];
    for (const item of current) {
      const r = await runOne(item);
      if (r.ok) {
        successCount++;
      } else {
        failed.push({ ...item, retries: item.retries + 1, lastError: r.error });
      }
    }
    setQueue(failed);
    qc.invalidateQueries();
    setSyncing(false);
    if (successCount > 0) toast.success(`تمت مزامنة ${successCount} عملية`);
    if (failed.length > 0) toast.error(`فشلت مزامنة ${failed.length} عملية`);
  }, [runOne, qc, syncing]);

  // Auto-flush when online
  useEffect(() => {
    if (online && queue.length > 0 && !syncing) {
      void flush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Try once on mount if there are pending ops
  useEffect(() => {
    if (online && load().length > 0) void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Ctx>(
    () => ({ online, queue, enqueue, flush, remove, clear, syncing }),
    [online, queue, enqueue, flush, remove, clear, syncing]
  );

  return <OfflineCtx.Provider value={value}>{children}</OfflineCtx.Provider>;
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineCtx);
  if (!ctx) throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  return ctx;
}

/**
 * Wrapper for write operations that auto-queues when offline.
 * Usage:
 *   const { run } = useOfflineMutation();
 *   await run({ table: "invoices", op: "insert", payload: {...} });
 */
export function useOfflineMutation() {
  const { online, enqueue } = useOfflineQueue();
  const run = useCallback(
    async (op: Omit<QueuedOp, "id" | "createdAt" | "retries">) => {
      if (!online) {
        enqueue(op);
        return { queued: true as const };
      }
      const table = supabase.from(op.table as never);
      let res;
      if (op.op === "insert") res = await (table as any).insert(op.payload);
      else if (op.op === "upsert") res = await (table as any).upsert(op.payload);
      else if (op.op === "update") {
        let q = (table as any).update(op.payload);
        for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v);
        res = await q;
      } else {
        let q = (table as any).delete();
        for (const [k, v] of Object.entries(op.match || {})) q = q.eq(k, v);
        res = await q;
      }
      // Network failure → queue
      if (res?.error && /network|fetch|failed to fetch/i.test(res.error.message)) {
        enqueue(op);
        return { queued: true as const };
      }
      if (res?.error) throw new Error(res.error.message);
      return { queued: false as const, data: res?.data };
    },
    [online, enqueue]
  );
  return { run, online };
}
