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

function measureLabelWidth(
  groups: { text: string; size: number; weight: number; indent: number }[]
): number {
  if (typeof document === "undefined") return 420;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 420;
  let max = 0;
  for (const g of groups) {
    ctx.font = `${g.weight} ${g.size}px "Cairo", "Tajawal", system-ui, sans-serif`;
    // Wider buffer absorbs Cairo web-font metric drift and active/hover glow room.
    const w = ctx.measureText(g.text).width * 1.35 + g.indent;
    if (w > max) max = w;
  }
  // icon + gap + nesting/padding + glow/active indicator breathing room.
  const total = Math.ceil(max + 22 + 14 + 72 + 44 + 56);
  return Math.max(420, Math.min(900, total));
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

  // Dynamic width — auto-fit widest label across all three levels
  const sidebarWidth = useMemo(() => {
    const grandparents = ["nav.financialAccounting", "nav.generalSetting"];
    const parents = [
      "nav.dashboard", "nav.reports", "nav.accountsReceivable", "nav.accountsPayable",
      "nav.banksGroup", "nav.fixedAssets", "nav.loansGroup", "nav.gl", "nav.configuration",
      "nav.purchaseProcurement", "nav.inventoryManagement", "nav.humanResources",
    ];
    const children = [
      "nav.mainDashboard", "nav.balanceSheet", "nav.incomeStatement", "nav.aging", "nav.vatReport",
      "nav.arDashboard", "ar.invoices", "ar.creditMemo", "ar.receipts", "ar.customers",
      "nav.apDashboard", "ap.bills", "ap.debitMemo", "ap.payments", "ap.vendors",
      "nav.banksDashboard", "banksGroup.accounts", "banksGroup.receipts", "banksGroup.payments",
      "banksGroup.expenses", "banksGroup.reconciliations",
      "nav.fixedAssetsDashboard", "nav.assets",
      "nav.loansDashboard", "nav.loans",
      "nav.journalEntries", "nav.trialBalance",
      "nav.chartOfAccounts", "nav.journalTypes", "nav.currencies", "nav.taxesTypes",
      "nav.fiscalPeriods", "nav.paymentMethods", "nav.lockDates", "approvals.title",
      "nav.companiesBranches", "nav.users",
    ];
    const entries = [
      ...grandparents.map((k) => ({ text: t(k), size: 17, weight: 800, indent: 0 })),
      ...parents.map((k) => ({ text: t(k), size: 14.5, weight: 700, indent: 24 })),
      ...children.map((k) => ({ text: t(k), size: 13.5, weight: 500, indent: 48 })),
    ].filter((e) => !!e.text);
    return measureLabelWidth(entries);
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
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </DailyUpdateGate>
  );
}
