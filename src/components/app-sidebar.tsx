import { Link, useRouterState } from "@tanstack/react-router";
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
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n";

export function AppSidebar() {
  const { t } = useI18n();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  const groups = [
    {
      label: t("nav.dashboard"),
      items: [
        { url: "/dashboard", icon: LayoutDashboard, title: t("nav.dashboard") },
      ],
    },
    {
      label: t("nav.accountsReceivable"),
      items: [
        { url: "/invoices/customer", icon: FileText, title: t("ar.invoices") },
        { url: "/credit-memos", icon: Receipt, title: t("ar.creditMemo") },
        { url: "/receipts", icon: Wallet, title: t("ar.receipts") },
        { url: "/customers", icon: Users, title: t("ar.customers") },
      ],
    },
    {
      label: t("nav.accountsPayable"),
      items: [
        { url: "/invoices/vendor", icon: Receipt, title: t("ap.bills") },
        { url: "/debit-memos", icon: FileText, title: t("ap.debitMemo") },
        { url: "/payments", icon: Wallet, title: t("ap.payments") },
        { url: "/vendors", icon: Users, title: t("ap.vendors") },
      ],
    },
    {
      label: t("nav.banksGroup"),
      items: [
        { url: "/banks", icon: Landmark, title: t("banksGroup.accounts") },
        { url: "/receipts", icon: Wallet, title: t("banksGroup.receipts") },
        { url: "/payments", icon: Wallet, title: t("banksGroup.payments") },
        { url: "/bank-expenses", icon: Coins, title: t("banksGroup.expenses") },
        { url: "/bank-reconciliations", icon: Calculator, title: t("banksGroup.reconciliations") },
      ],
    },
    {
      label: t("nav.fixedAssets"),
      items: [
        { url: "/assets", icon: Briefcase, title: t("nav.assets") },
      ],
    },
    {
      label: t("nav.loansGroup"),
      items: [
        { url: "/loans", icon: CreditCard, title: t("nav.loans") },
      ],
    },
    {
      label: t("nav.gl"),
      items: [
        { url: "/journal-entries", icon: BookOpen, title: t("nav.journalEntries") },
        { url: "/trial-balance", icon: Calculator, title: t("nav.trialBalance") },
        { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
      ],
    },
    {
      label: t("nav.reports"),
      items: [
        { url: "/reports/balance-sheet", icon: Scale, title: t("nav.balanceSheet") },
        { url: "/reports/income-statement", icon: TrendingUp, title: t("nav.incomeStatement") },
        { url: "/reports/aging", icon: FileText, title: t("nav.aging") },
        { url: "/reports/vat", icon: Receipt, title: t("nav.vatReport") },
      ],
    },
    {
      label: t("nav.configuration"),
      items: [
        { url: "/companies", icon: Building2, title: t("nav.companiesBranches") },
        { url: "/accounts", icon: BookOpen, title: t("nav.chartOfAccounts") },
        { url: "/cost-centers", icon: Wallet, title: t("nav.costCenters") },
        { url: "/journals", icon: BookOpen, title: t("nav.journalTypes") },
        { url: "/currencies", icon: Coins, title: t("nav.currencies") },
        { url: "/taxes", icon: Receipt, title: t("nav.taxesTypes") },
        { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
        { url: "/payment-methods", icon: CreditCard, title: t("nav.paymentMethods") },
        { url: "/lock-dates", icon: Lock, title: t("nav.lockDates") },
        { url: "/users", icon: Users, title: t("nav.users") },
        { url: "/settings", icon: Settings, title: t("nav.generalSettings") },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-l">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
            AH
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">{t("common.appShort")}</span>
              <span className="text-[10px] text-sidebar-foreground/60">Enterprise</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel className="text-base font-bold py-2 text-primary-light">{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
