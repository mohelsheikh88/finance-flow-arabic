import {
  LayoutDashboard,
  FileQuestion,
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
  Tags,
  Ruler,
  ShieldAlert,
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
  UserCog,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

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
// STANDING RULE: every top-level module that has real content (i.e. its own
// subgroups, not a "will be built later" stub) MUST end its Configuration
// subgroup with these two links:
//   1. { url: "/approvals", ... }              — shared Hierarchical Approvals screen
//   2. { url: "/<module>-user-access", ... }   — that module's own Sub-Modules
//      Access + Users Roles page (copy accounting-user-access.tsx / purchase-user-access.tsx,
//      swap moduleKey/moduleScope and the groups.find(g => g.key === "...") match).
// Accounting and Purchase already follow this. Apply it to every future
// module (inventory, HR, HIS, fleets, sales...) the moment it gets real
// subgroups instead of a stub.
export function useNavGroups(): NavGroup[] {
  const { t } = useI18n();
  const { data: sortMap } = useQuery({
    queryKey: ["module_sort_order"],
    queryFn: async () => {
      const { data, error } = await supabase.from("module_sort_order").select("module_key, sort_order");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data as any[]) map.set(row.module_key, row.sort_order);
      return map;
    },
    staleTime: 60_000,
  });

  const groups: NavGroup[] = [
    {
      key: "mainDashboard",
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
            { url: "/partners", icon: Users, title: t("partners.pageTitle") },
            { url: "/accounts", icon: BookOpen, title: t("nav.chartOfAccounts") },
            { url: "/journals", icon: BookOpen, title: t("nav.journalTypes") },
            { url: "/currencies", icon: Coins, title: t("nav.currencies") },
            { url: "/taxes", icon: Receipt, title: t("nav.taxesTypes") },
            { url: "/fiscal-positions", icon: Scale, title: t("nav.fiscalPositions") },
            { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
            { url: "/payment-methods", icon: CreditCard, title: t("nav.paymentMethods") },
            { url: "/payment-terms", icon: CreditCard, title: t("nav.paymentTerms") },
            { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
            { url: "/accounting-user-access", icon: UserCog, title: t("common.sectionAccessTitle") },
          ],
        },
      ],
    },
    {
      key: "purchase",
      label: t("nav.purchaseProcurement"),
      icon: ShoppingBag,
      hue: 25, // orange — procurement
      subgroups: [
        {
          key: "purchaseReports",
          label: t("nav.purchaseReports"),
          icon: BarChart3,
          hue: 25,
          items: [
            { url: "/dashboards/purchase", icon: LayoutDashboard, title: t("nav.purchaseDashboard") },
            { url: "/reports/purchase-orders", icon: FileText, title: t("purchase.reportOrders") },
            { url: "/reports/purchase-vendor-spend", icon: Users, title: t("purchase.reportVendorSpend") },
            { url: "/reports/purchase-products", icon: Tags, title: t("purchase.reportProductSpend") },
            { url: "/reports/purchase-category-spend", icon: BarChart3, title: t("purchase.reportCategorySpend") },
          ],
        },
        {
          key: "quotations",
          label: t("nav.quotations"),
          icon: FileQuestion,
          hue: 25,
          items: [
            { url: "/rfqs", icon: FileQuestion, title: t("nav.quotations") },
          ],
        },
        {
          key: "purchaseOrders",
          label: t("nav.purchaseOrders"),
          icon: FileText,
          hue: 25,
          items: [
            { url: "/purchase-orders", icon: FileText, title: t("nav.purchaseOrders") },
          ],
        },
        {
          key: "purchaseConfiguration",
          label: t("nav.configuration"),
          icon: SlidersHorizontal,
          hue: 25,
          items: [
            { url: "/product-categories", icon: Tags, title: t("purchase.productCategories") },
            { url: "/product-types", icon: Tags, title: t("purchase.productTypesTitle") },
            { url: "/products", icon: Tags, title: t("purchase.products") },
            { url: "/compliance-tracking", icon: ShieldAlert, title: t("purchase.complianceTracking") },
            { url: "/units-of-measure", icon: Ruler, title: t("nav.unitsOfMeasure") },
            { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
            { url: "/purchase-user-access", icon: UserCog, title: t("common.sectionAccessTitle") },
          ],
        },
      ],
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
          hue: 172, // HHC brand green — matches Hayat Homecare's official identity
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
          hue: 319, // HML brand purple/pink — matches Hayat Medical Laboratories' official identity
          items: [{ url: "/laboratory", icon: FlaskConical, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "radiology",
          label: t("nav.radiology"),
          icon: Scan,
          hue: 195,
          items: [{ url: "/radiology", icon: Scan, title: t("common.willBeBuiltLater") }],
        },
        {
          key: "medicalConfiguration",
          label: t("nav.configuration"),
          icon: SlidersHorizontal,
          hue: 180,
          items: [
            { url: "/medical-configuration", icon: SlidersHorizontal, title: t("common.willBeBuiltLater") },
            { url: "/medical-approvals", icon: ShieldCheck, title: t("approvals.title") },
          ],
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

  // Admin-configurable order (Modules Management screen). Anything not
  // explicitly ordered yet keeps its original position in the list above.
  const orderOf = (key: string | undefined, fallbackIndex: number) =>
    key && sortMap?.has(key) ? sortMap.get(key)! : fallbackIndex;

  const sortedGroups = groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => orderOf(a.g.key, a.i) - orderOf(b.g.key, b.i))
    .map(({ g }) => {
      if (!g.subgroups) return g;
      const sortedSubgroups = g.subgroups
        .map((sg, i) => ({ sg, i }))
        .sort((a, b) => orderOf(a.sg.key, a.i) - orderOf(b.sg.key, b.i))
        .map(({ sg }) => sg);
      return { ...g, subgroups: sortedSubgroups };
    });

  return sortedGroups;
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
  if (group.subgroups && group.subgroups.length > 0) return group.subgroups[0].items[0]?.url ?? "/apps";
  return group.items?.[0]?.url ?? "/apps";
}

/**
 * Pages that render as a full-screen card grid (no sidebar): just the
 * main Apps launcher. Every module goes straight to a real content page
 * with the sidebar showing its full menu tree — no intermediate
 * "pick a section" step.
 */
export function isLauncherPath(pathname: string): boolean {
  return pathname === "/apps";
}

/**
 * Which modules (by group.key) the current user is allowed to see.
 * Shared by the sidebar and the Apps launcher grid so they never disagree.
 */
/**
 * A user's effective module access is the UNION of two independent
 * grants: direct per-user assignment (user_module_access) AND everything
 * granted by any user group (Doctors, Finance, Nursing...) they belong
 * to. Either one is enough — this is what gives maximum flexibility:
 * assign a module straight to one person, or to a whole group at once.
 */
export function useModuleAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_module_access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: mods }, { data: roles }, { data: memberships }] = await Promise.all([
        supabase.from("user_module_access").select("module_key").eq("user_id", user!.id),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("user_group_members").select("group_id").eq("user_id", user!.id),
      ]);

      const groupIds = (memberships ?? []).map((m: any) => m.group_id as string);
      let groupModules: string[] = [];
      if (groupIds.length > 0) {
        const { data: gm } = await supabase.from("user_group_modules").select("module_key").in("group_id", groupIds);
        groupModules = (gm ?? []).map((r: any) => r.module_key as string);
      }
      const directModules = (mods ?? []).map((m: any) => m.module_key as string);

      return {
        modules: Array.from(new Set([...directModules, ...groupModules])),
        isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
      };
    },
  });
}

/**
 * Nav groups filtered down to the ones this user is actually allowed to
 * open, based on per-user/group module access (direct `user_module_access`
 * UNION any user group's granted modules). Admins are never restricted by
 * this, so the one admin account always sees everything.
 *
 * Three levels, each fail-open ONLY once we actually know the user's
 * access — never while it's still loading. A restricted user refreshing
 * the page must never even briefly glimpse a module they don't have;
 * better to render nothing for an instant than flash it and yank it away.
 *  1. Top-level module (e.g. "accounting")
 *  2. Section within it (e.g. "accountsReceivable")
 *  3. Individual screen within a section (e.g. "/invoices/customer") —
 *     keyed by URL. Restricting screens is SCOPED to the section they
 *     belong to: an admin only has to grant specific screens for the
 *     sections they actually want to narrow down. Every other section
 *     everywhere keeps showing all of its screens by default, so
 *     configuring one section never silently locks down unrelated ones.
 */
export function useVisibleNavGroups(): NavGroup[] {
  const groups = useNavGroups();
  const { data: myAccess, isPending } = useModuleAccess();
  const isAdmin = !!myAccess?.isAdmin;
  const stillLoading = isPending || !myAccess;

  const passesUserAccess = (key?: string) => {
    if (!key) return true;
    if (stillLoading) return false; // fail CLOSED while loading
    if (isAdmin) return true;
    if (myAccess.modules.length === 0) return true; // nothing configured yet = unrestricted
    return myAccess.modules.includes(key);
  };

  // Screen-level check, scoped to the section it lives in — only
  // restricts if THIS section has at least one screen explicitly granted.
  const passesItemInSection = (sectionItems: NavItem[], itemUrl: string) => {
    if (stillLoading) return false; // fail CLOSED while loading
    if (isAdmin) return true;
    const sectionHasExplicitGrants = sectionItems.some((it) => myAccess.modules.includes(it.url));
    if (!sectionHasExplicitGrants) return true; // fail open for this section
    return myAccess.modules.includes(itemUrl);
  };

  return groups
    .filter((g) => passesUserAccess(g.key))
    .map((g) => {
      if (!g.subgroups) return g;
      return {
        ...g,
        subgroups: g.subgroups
          .filter((sg) => passesUserAccess(sg.key))
          .map((sg) => ({
            ...sg,
            items: sg.items.filter((it) => passesItemInSection(sg.items, it.url)),
          })),
      };
    });
}
