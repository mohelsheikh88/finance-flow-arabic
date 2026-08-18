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
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export type NavItem = { url: string; icon: any; title: string };
export type NavSubgroup = { label: string; icon: any; items: NavItem[] };
export type NavGroup = {
  key?: string;
  label: string;
  icon: any;
  /** HSL hue (0-360) used to color this module's icon on the Apps launcher — chosen to be meaningful (e.g. green for money, red for medical). */
  hue: number;
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
          label: t("nav.reports"),
          icon: BarChart3,
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
          label: t("nav.accountsReceivable"),
          icon: HandCoins,
          items: [
            { url: "/dashboards/ar", icon: LayoutDashboard, title: t("nav.arDashboard") },
            { url: "/invoices/customer", icon: FileText, title: t("ar.invoices") },
            { url: "/credit-memos", icon: Receipt, title: t("ar.creditMemo") },
            { url: "/receipts", icon: Wallet, title: t("ar.receipts") },
            { url: "/customers", icon: Users, title: t("ar.customers") },
          ],
        },
        {
          label: t("nav.accountsPayable"),
          icon: ShoppingCart,
          items: [
            { url: "/dashboards/ap", icon: LayoutDashboard, title: t("nav.apDashboard") },
            { url: "/invoices/vendor", icon: Receipt, title: t("ap.bills") },
            { url: "/debit-memos", icon: FileText, title: t("ap.debitMemo") },
            { url: "/payments", icon: Wallet, title: t("ap.payments") },
            { url: "/vendors", icon: Users, title: t("ap.vendors") },
          ],
        },
        {
          label: t("nav.banksGroup"),
          icon: Landmark,
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
          label: t("nav.fixedAssets"),
          icon: Briefcase,
          items: [
            { url: "/dashboards/fixed-assets", icon: LayoutDashboard, title: t("nav.fixedAssetsDashboard") },
            { url: "/assets", icon: Briefcase, title: t("nav.assets") },
          ],
        },
        {
          label: t("nav.loansGroup"),
          icon: CreditCard,
          items: [
            { url: "/dashboards/loans", icon: LayoutDashboard, title: t("nav.loansDashboard") },
            { url: "/loans", icon: CreditCard, title: t("nav.loans") },
          ],
        },
        {
          label: t("nav.gl"),
          icon: BookOpen,
          items: [
            { url: "/journal-entries", icon: BookOpen, title: t("nav.journalEntries") },
            { url: "/trial-balance", icon: Calculator, title: t("nav.trialBalance") },
          ],
        },
        {
          label: t("nav.configuration"),
          icon: SlidersHorizontal,
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
          label: t("nav.insurance"),
          icon: Umbrella,
          items: [{ url: "/insurance", icon: Umbrella, title: t("common.willBeBuiltLater") }],
        },
        {
          label: t("nav.pharmacy"),
          icon: Pill,
          items: [{ url: "/pharmacy", icon: Pill, title: t("common.willBeBuiltLater") }],
        },
        {
          label: t("nav.homeCare"),
          icon: Home,
          items: [{ url: "/home-care", icon: Home, title: t("common.willBeBuiltLater") }],
        },
        {
          label: t("nav.ambulance"),
          icon: Ambulance,
          items: [{ url: "/ambulance", icon: Ambulance, title: t("common.willBeBuiltLater") }],
        },
        {
          label: t("nav.outpatientClinics"),
          icon: ClipboardPlus,
          items: [{ url: "/outpatient-clinics", icon: ClipboardPlus, title: t("common.willBeBuiltLater") }],
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

/** The first navigable URL inside a group — used as the card/back-button target. */
export function groupHomeUrl(group: NavGroup): string {
  return group.subgroups?.[0]?.items[0]?.url ?? group.items?.[0]?.url ?? "/apps";
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

/** Nav groups filtered down to the ones this user is actually allowed to open. */
export function useVisibleNavGroups(): NavGroup[] {
  const groups = useNavGroups();
  const { data: myAccess } = useModuleAccess();

  return groups.filter((g) => {
    if (!g.key) return true;
    if (!myAccess) return true;
    if (myAccess.isAdmin) return true;
    if (myAccess.modules.length === 0) return true;
    return myAccess.modules.includes(g.key);
  });
}
