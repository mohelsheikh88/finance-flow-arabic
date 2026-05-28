import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { Loader2 } from "lucide-react";
import { DailyUpdateGate } from "@/components/daily-update-gate";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const PIN_KEY = "sidebar:pinned";

function measureLabelWidth(labels: string[]): number {
  if (typeof document === "undefined") return 264;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 264;
  ctx.font = '600 14px "Cairo", "Tajawal", system-ui, sans-serif';
  let maxText = 0;
  for (const l of labels) {
    const w = ctx.measureText(l).width;
    if (w > maxText) maxText = w;
  }
  // icon (18) + gap (10) + chevron (16) + padding (32) + indents/safety (40)
  const total = Math.ceil(maxText + 18 + 10 + 16 + 32 + 40);
  return Math.max(240, Math.min(420, total));
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { dir, t } = useI18n();
  const navigate = useNavigate();

  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(PIN_KEY);
    return v === null ? true : v === "1";
  });
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const onTogglePin = () => {
    setPinned((p) => {
      const next = !p;
      try { window.localStorage.setItem(PIN_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const open = pinned || hovered;

  // Dynamic width — measure widest top-level + subgroup labels
  const sidebarWidth = useMemo(() => {
    const labels = [
      t("nav.financialAccounting"),
      t("nav.generalSetting"),
      t("nav.dashboard"),
      t("nav.reports"),
      t("nav.accountsReceivable"),
      t("nav.accountsPayable"),
      t("nav.banksGroup"),
      t("nav.fixedAssets"),
      t("nav.loansGroup"),
      t("nav.gl"),
      t("nav.configuration"),
      t("nav.companiesBranches"),
      t("nav.users"),
      t("nav.chartOfAccounts"),
      t("nav.balanceSheet"),
      t("nav.incomeStatement"),
    ].filter(Boolean) as string[];
    return measureLabelWidth(labels);
  }, [t]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleEnter = () => {
    if (pinned) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(true), 80);
  };
  const handleLeave = () => {
    if (pinned) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(false), 180);
  };

  return (
    <DailyUpdateGate>
      <SidebarProvider
        open={open}
        onOpenChange={(v) => { if (pinned) return; setHovered(v); }}
        style={{
          ["--sidebar-width" as any]: `${sidebarWidth}px`,
        }}
      >
        <div className="min-h-screen flex w-full bg-app-surface" dir={dir}>
          <div
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className="contents"
          >
            <AppSidebar pinned={pinned} onTogglePin={onTogglePin} />
          </div>
          <div className="flex-1 flex flex-col min-w-0 relative z-10">
            <Topbar />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DailyUpdateGate>
  );
}
