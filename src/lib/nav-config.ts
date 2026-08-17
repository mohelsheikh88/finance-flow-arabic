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
} from "lucide-react";
import { useI18n } from "@/i18n";

export type NavItem = { url: string; icon: any; title: string };
export type NavSubgroup = { label: string; icon: any; items: NavItem[] };
export type NavGroup = {
  key?: string;
  label: string;
  icon: any;
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
      key: "accounting",
      label: t("nav.financialAccounting"),
      icon: Wallet,
      subgroups: [
        {
          label: t("nav.dashboard"),
          icon: LayoutDashboard,
          items: [{ url: "/dashboard", icon: LayoutDashboard, title: t("nav.mainDashboard") }],
        },
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
      items: [{ url: "/purchase", icon: ShoppingBag, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "inventory",
      label: t("nav.inventoryManagement"),
      icon: Package,
      items: [{ url: "/inventory", icon: Package, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "hr",
      label: t("nav.humanResources"),
      icon: UsersRound,
      items: [{ url: "/hr", icon: UsersRound, title: t("common.willBeBuiltLater") }],
    },
    {
      key: "settings",
      label: t("nav.generalSetting"),
      icon: Settings,
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
