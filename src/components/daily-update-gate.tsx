import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { runDailyMaintenance } from "@/lib/api/maintenance.functions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const storageKey = (userId: string) => `daily-update:${userId}`;

type Phase = "checking" | "running" | "done" | "skip";

export function DailyUpdateGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { companyId } = useBranch();
  const { locale } = useI18n();
  const qc = useQueryClient();
  const runFn = useServerFn(runDailyMaintenance);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = todayKey();
    let last: string | null = null;
    try {
      last = localStorage.getItem(storageKey(user.id));
    } catch {
      last = null;
    }
    if (last === today) {
      setPhase("skip");
      return;
    }
    setPhase("running");
    (async () => {
      try {
        await runFn({ data: { companyId: companyId ?? null, day: today } });
        // Invalidate all cached queries so the UI shows fresh data.
        await qc.invalidateQueries();
        try {
          localStorage.setItem(storageKey(user.id), today);
        } catch {
          /* ignore */
        }
        setPhase("done");
        // Brief success flash before revealing the app
        setTimeout(() => setPhase("skip"), 600);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        // Don't block the app on failure — still let user in after a moment.
        setTimeout(() => setPhase("skip"), 1500);
      }
    })();
    // run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (phase === "skip") return <>{children}</>;

  const ar = locale === "ar";
  const title =
    phase === "done"
      ? ar
        ? "تم التحديث"
        : "Up to date"
      : ar
        ? "جاري تحديث النظام"
        : "Updating system";
  const subtitle = error
    ? error
    : phase === "done"
      ? ar
        ? "تم تحديث بيانات اليوم بنجاح"
        : "Today's data has been refreshed"
      : ar
        ? "نقوم بتحديث البيانات اليومية، لحظات من فضلك..."
        : "Refreshing today's data, just a moment...";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
        <div className="relative">
          {phase === "done" ? (
            <CheckCircle2 className="h-12 w-12 text-success" />
          ) : (
            <>
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <Loader2 className="absolute inset-0 h-12 w-12 text-primary/30 animate-pulse" />
            </>
          )}
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
