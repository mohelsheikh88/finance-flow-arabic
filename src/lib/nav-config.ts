import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Landmark,
  Building2,
  BookOpen,
  Calculator,
  Scale,
  Settings,
  Briefcase,
  CreditCard,
  Coins,
  CalendarRange,
  Wallet,
  TrendingUp,
  Activity,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
  Package,
  UsersRound,
  BarChart3,
  SlidersHorizontal,
  HandCoins,
  Stethoscope,
  Pill,
  Umbrella,
  Truck,
  LineChart,
  Handshake,
  Home,
  Ambulance,
  ClipboardPlus,
  Blocks,
  Siren,
  FlaskConical,
  Scan,
  UserCheck,
  ClipboardCheck,
  CalendarClock,
  Tv,
  HeartPulse,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";

export type NavItem = { url: string; icon: any; title: string };
export type NavSubgroup = { key?: string; label: string; icon: any; hue?: number; items: NavItem[] };
export type NavGroup = {
  key?: string;
  label: string;
  icon: any;
  /** HSL hue (0-360) used to color this module's icon on the Apps launcher — chosen to be meaningful (e.g. green for money, red for medical). */
  hue: number;
  /** Optional explicit landing page for this module's card (e.g. a sub-launcher grid). Overrides the default "first item" behavior. */
  homeUrl?: string;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
};

/**
 * Shared navigation tree — single source of truth used by both the
 * sidebar (app-sidebar.tsx) and the top breadcrumb trail (breadcrumbs.tsx).
 */
export function useNavGroups(): NavGroup[] {
  const { t } = useI18n();

  return [
    {
      label: t("nav.mainDashboard"),
      icon: LayoutDashboard,
      hue: 199, // sky blue — overview
      items: [{ url: "/dashboard", icon: LayoutDashboard, title: t("nav.mainDashboard") }],
    },
    {
      key: "accounting",
      label: t("nav.financialAccounting"),
      icon: Wallet,
      hue: 42, // gold/amber — money, finance
      subgroups: [
        {
          key: "reports",
          label: t("nav.reports"),
          icon: BarChart3,
          hue: 265,
          items: [
            { url: "/reports/executive-summary", icon: Activity, title: t("nav.executiveSummary") },
            { url: "/reports/balance-sheet", icon: Scale, title: t("nav.balanceSheet") },
            { url: "/reports/income-statement", icon: TrendingUp, title: t("nav.incomeStatement") },
            { url: "/reports/cash-flow", icon: Wallet, title: t("nav.cashFlow") },
            { url: "/reports/aging", icon: FileText, title: t("nav.aging") },
            { url: "/reports/vat", icon: Receipt, title: t("nav.vatReport") },
          ],
        },
        {
          key: "accountsReceivable",
          label: t("nav.accountsReceivable"),
          icon: HandCoins,
          hue: 140,
          items: [
            { url: "/dashboards/ar", icon: LayoutDashboard, title: t("nav.arDashboard") },
            { url: "/invoices/customer", icon: FileText, title: t("ar.invoices") },
            { url: "/credit-memos", icon: Receipt, title: t("ar.creditMemo") },
            { url: "/receipts", icon: Wallet, title: t("ar.receipts") },
            { url: "/customers", icon: Users, title: t("ar.customers") },
          ],
        },
        {
          key: "accountsPayable",
          label: t("nav.accountsPayable"),
          icon: ShoppingCart,
          hue: 20,
          items: [
            { url: "/dashboards/ap", icon: LayoutDashboard, title: t("nav.apDashboard") },
            { url: "/invoices/vendor", icon: Receipt, title: t("ap.bills") },
            { url: "/debit-memos", icon: FileText, title: t("ap.debitMemo") },
            { url: "/payments", icon: Wallet, title: t("ap.payments") },
            { url: "/vendors", icon: Users, title: t("ap.vendors") },
          ],
        },
        {
          key: "banks",
          label: t("nav.banksGroup"),
          icon: Landmark,
          hue: 205,
          items: [
            { url: "/dashboards/banks", icon: LayoutDashboard, title: t("nav.banksDashboard") },
            { url: "/banks", icon: Landmark, title: t("banksGroup.accounts") },
            { url: "/receipts", icon: Wallet, title: t("banksGroup.receipts") },
            { url: "/payments", icon: Wallet, title: t("banksGroup.payments") },
            { url: "/bank-expenses", icon: Coins, title: t("banksGroup.expenses") },
            { url: "/bank-reconciliations", icon: Calculator, title: t("banksGroup.reconciliations") },
          ],
        },
        {
          key: "fixedAssets",
          label: t("nav.fixedAssets"),
          icon: Briefcase,
          hue: 45,
          items: [
            { url: "/dashboards/fixed-assets", icon: LayoutDashboard, title: t("nav.fixedAssetsDashboard") },
            { url: "/assets", icon: Briefcase, title: t("nav.assets") },
          ],
        },
        {
          key: "loans",
          label: t("nav.loansGroup"),
          icon: CreditCard,
          hue: 330,
          items: [
            { url: "/dashboards/loans", icon: LayoutDashboard, title: t("nav.loansDashboard") },
            { url: "/loans", icon: CreditCard, title: t("nav.loans") },
          ],
        },
        {
          key: "gl",
          label: t("nav.gl"),
          icon: BookOpen,
          hue: 95,
          items: [
            { url: "/journal-entries", icon: BookOpen, title: t("nav.journalEntries") },
            { url: "/trial-balance", icon: Calculator, title: t("nav.trialBalance") },
          ],
        },
        {
          key: "accountingConfiguration",
          label: t("nav.configuration"),
          icon: SlidersHorizontal,
          hue: 180,
          items: [
            { url: "/accounts", icon: BookOpen, title: t("nav.chartOfAccounts") },
            { url: "/journals", icon: BookOpen, title: t("nav.journalTypes") },
            { url: "/currencies", icon: Coins, title: t("nav.currencies") },
            { url: "/taxes", icon: Receipt, title: t("nav.taxesTypes") },
            { url: "/fiscal-positions", icon: Scale, title: t("nav.fiscalPositions") },
            { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
            { url: "/payment-methods", icon: CreditCard, title: t("nav.paymentMethods") },
            { url: "/payment-terms", icon: CreditCard, title: t("nav.paymentTerms") },
            { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
          ],
        },
      ],
    },
    {
      key: "purchase",
      label: t("nav.purchaseProcurement"),
      icon: ShoppingBag,
      hue: 25, // orange — procurement
      items: [{ url: "/purchase", icon: ShoppingBag, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "inventory",
      label: t("nav.inventoryManagement"),
      icon: Package,
      hue: 217, // indigo/blue — logistics, boxes
      items: [{ url: "/inventory", icon: Package, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "hr",
      label: t("nav.humanResources"),
      icon: UsersRound,
      hue: 271, // violet — people
      items: [{ url: "/hr", icon: UsersRound, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "his",
      label: t("nav.his"),
      icon: Stethoscope,
      hue: 351, // red/rose — medical
      subgroups: [
        {
          key: "insurance",
          label: t("nav.insurance"),
          icon: Umbrella,
          hue: 224,
          items: [{ url: "/insurance", icon: Umbrella, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "pharmacy",
          label: t("nav.pharmacy"),
          icon: Pill,
          hue: 152,
          items: [{ url: "/pharmacy", icon: Pill, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "homeCare",
          label: t("nav.homeCare"),
          icon: Home,
          hue: 130,
          items: [{ url: "/home-care", icon: Home, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "ambulance",
          label: t("nav.ambulance"),
          icon: Ambulance,
          hue: 10,
          items: [{ url: "/ambulance", icon: Ambulance, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "outpatientClinics",
          label: t("nav.outpatientClinics"),
          icon: ClipboardPlus,
          hue: 188,
          items: [{ url: "/outpatient-clinics", icon: ClipboardPlus, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "medicalDashboard",
          label: t("nav.medicalDashboard"),
          icon: LayoutDashboard,
          hue: 199,
          items: [{ url: "/medical-dashboard", icon: LayoutDashboard, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "reception",
          label: t("nav.reception"),
          icon: ClipboardCheck,
          hue: 60,
          items: [{ url: "/reception", icon: ClipboardCheck, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "appointments",
          label: t("nav.appointments"),
          icon: CalendarClock,
          hue: 230,
          items: [{ url: "/appointments", icon: CalendarClock, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "waitingScreen",
          label: t("nav.waitingScreen"),
          icon: Tv,
          hue: 210,
          items: [{ url: "/waiting-screen", icon: Tv, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "physician",
          label: t("nav.physician"),
          icon: UserCheck,
          hue: 170,
          items: [{ url: "/physician", icon: UserCheck, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "patients",
          label: t("nav.patients"),
          icon: HeartPulse,
          hue: 340,
          items: [{ url: "/patients", icon: HeartPulse, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "emergency",
          label: t("nav.emergency"),
          icon: Siren,
          hue: 355,
          items: [{ url: "/emergency", icon: Siren, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "laboratory",
          label: t("nav.laboratory"),
          icon: FlaskConical,
          hue: 265,
          items: [{ url: "/laboratory", icon: FlaskConical, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "radiology",
          label: t("nav.radiology"),
          icon: Scan,
          hue: 195,
          items: [{ url: "/radiology", icon: Scan, title: t("common.willBeBuiltLater") }],
        },
      ],
    },
    {
      key: "fleets",
      label: t("nav.fleets"),
      icon: Truck,
      hue: 45, // amber — vehicles, transport
      items: [{ url: "/fleets", icon: Truck, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "sales",
      label: t("nav.sales"),
      icon: LineChart,
      hue: 175, // teal-emerald — growth
      items: [{ url: "/sales", icon: LineChart, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "crm",
      label: t("nav.crm"),
      icon: Handshake,
      hue: 300, // magenta — relationships
      items: [{ url: "/crm", icon: Handshake, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "settings",
      label: t("nav.generalSetting"),
      icon: Settings,
      hue: 215, // neutral slate-blue — configuration
      items: [
        { url: "/companies", icon: Building2, title: t("nav.companiesBranches") },
        { url: "/users", icon: Users, title: t("nav.users") },
        { url: "/modules-management", icon: Blocks, title: t("nav.modulesManagement") },
      ],
    },
  ];
}

/**
 * Given the current pathname, find the matching group / subgroup / item
 * so the breadcrumb trail can be rendered.
 */
export function matchNavPath(groups: NavGroup[], pathname: string) {
  const isMatch = (url: string) => pathname === url || pathname.startsWith(url + "/");

  for (const g of groups) {
    if (g.items) {
      const item = g.items.find((it) => isMatch(it.url));
      if (item) return { group: g, subgroup: null as NavSubgroup | null, item };
    }
    if (g.subgroups) {
      for (const sg of g.subgroups) {
        const item = sg.items.find((it) => isMatch(it.url));
        if (item) return { group: g, subgroup: sg, item };
      }
    }
  }
  return null;
}

/**
 * The card/back-button target for a module.
 * - Explicit `homeUrl` always wins (rare manual override).
 * - Any module that has `subgroups` automatically gets its own card-grid
 *   sub-launcher at /module/{key} — same principle for every module,
 *   present or future, so nobody has to remember to wire this up by hand.
 * - A flat module (only `items`, no `subgroups`) just opens its first item.
 */
export function groupHomeUrl(group: NavGroup): string {
  if (group.homeUrl) return group.homeUrl;
  if (group.subgroups && group.subgroups.length > 0 && group.key) return `/module/${group.key}`;
  return group.items?.[0]?.url ?? "/apps";
}

/**
 * Pages that render as a full-screen card grid (no sidebar): the main Apps
 * launcher, plus every module's own sub-launcher at /module/{key}.
 */
export function isLauncherPath(pathname: string): boolean {
  return pathname === "/apps" || pathname.startsWith("/module/");
}

/**
 * Which modules (by group.key) the current user is allowed to see.
 * Shared by the sidebar and the Apps launcher grid so they never disagree.
 */
export function useModuleAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_module_access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: mods }, { data: roles }] = await Promise.all([
        supabase.from("user_module_access").select("module_key").eq("user_id", user!.id),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      return {
        modules: (mods ?? []).map((m: any) => m.module_key as string),
        isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
      };
    },
  });
}

/**
 * Which medical sub-modules (Insurance, Pharmacy, Home Care, Ambulance,
 * Outpatient Clinics) are actually turned on at the user's currently
 * active branch. Fails open (returns undefined) while loading or when no
 * branch is selected yet, so the UI doesn't flash an empty state.
 */
/**
 * Which modules — top-level or sub-modules, by their `key` — are turned
 * on at the user's currently active branch. Fails open (returns
 * undefined) while loading or when no branch is selected yet, so the UI
 * doesn't flash an empty state.
 */
export function useBranchModuleAccess() {
  const { branchId } = useBranch();
  return useQuery({
    queryKey: ["branch_module_access", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data } = await supabase
        .from("branch_module_access")
        .select("module_key, is_enabled")
        .eq("branch_id", branchId!);
      return (data ?? []).filter((r: any) => r.is_enabled).map((r: any) => r.module_key as string);
    },
  });
}

/**
 * Nav groups filtered down to the ones this user is actually allowed to
 * open — combining two independent layers, applied uniformly to BOTH
 * top-level modules and their sub-modules (anything with a `key`):
 *  1. User-level module access (`user_module_access` / admin role) —
 *     only ever applies to top-level modules.
 *  2. Branch-level module availability: which modules/sub-modules are
 *     enabled at the branch the user is currently working in. Admins
 *     always see everything regardless of branch configuration.
 */
export function useVisibleNavGroups(): NavGroup[] {
  const groups = useNavGroups();
  const { data: myAccess } = useModuleAccess();
  const { branchId } = useBranch();
  const { data: branchModules } = useBranchModuleAccess();
  const isAdmin = !!myAccess?.isAdmin;

  const passesBranch = (key?: string) => {
    if (!key) return true;
    if (isAdmin) return true;
    if (!branchId || branchModules === undefined) return true; // fail open
    return branchModules.includes(key);
  };

  return groups
    .filter((g) => {
      if (!g.key) return true;
      if (!myAccess) return true;
      if (isAdmin) return true;
      if (myAccess.modules.length > 0 && !myAccess.modules.includes(g.key)) return false;
      return passesBranch(g.key);
    })
    .map((g) => {
      if (!g.subgroups) return g;
      return { ...g, subgroups: g.subgroups.filter((sg) => passesBranch(sg.key)) };
    });
}
