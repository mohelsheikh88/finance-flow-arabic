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
  History,
  HandCoins,
  ShoppingCart,
  BarChart3,
  SlidersHorizontal,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
import { BrandLogo, BrandMark } from "@/components/brand-logo";



export function AppSidebar() {
  const { t, locale } = useI18n();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  const groups = [
    {
      label: t("nav.dashboard"),
      icon: LayoutDashboard,
      items: [
        { url: "/dashboard", icon: LayoutDashboard, title: t("nav.mainDashboard") },
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
      label: t("nav.reports"),
      icon: BarChart3,
      items: [
        { url: "/reports/balance-sheet", icon: Scale, title: t("nav.balanceSheet") },
        { url: "/reports/income-statement", icon: TrendingUp, title: t("nav.incomeStatement") },
        { url: "/reports/aging", icon: FileText, title: t("nav.aging") },
        { url: "/reports/vat", icon: Receipt, title: t("nav.vatReport") },
      ],
    },
    {
      label: t("nav.configuration"),
      icon: SlidersHorizontal,
      subgroups: [
        {
          label: t("nav.generalSetting"),
          icon: Settings,
          items: [
            { url: "/companies", icon: Building2, title: t("nav.companiesBranches") },
            { url: "/users", icon: Users, title: t("nav.users") },
          ],
        },
      ],
      items: [
        { url: "/accounts", icon: BookOpen, title: t("nav.chartOfAccounts") },
        { url: "/journals", icon: BookOpen, title: t("nav.journalTypes") },
        { url: "/currencies", icon: Coins, title: t("nav.currencies") },
        { url: "/taxes", icon: Receipt, title: t("nav.taxesTypes") },
        { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
        { url: "/payment-methods", icon: CreditCard, title: t("nav.paymentMethods") },
        { url: "/lock-dates", icon: Lock, title: t("nav.lockDates") },
        { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
        { url: "/audit-log", icon: History, title: "سجل التدقيق" },
        { url: "/settings", icon: Settings, title: t("nav.generalSettings") },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" side={locale === "ar" ? "right" : "left"} className={locale === "ar" ? "border-l" : "border-r"}>

      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          {collapsed ? (
            <BrandMark size={28} />
          ) : (
            <BrandLogo size={34} variant="light" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => {
          const groupActive = g.items?.some((it) => isActive(it.url)) || g.subgroups?.some((sg) => sg.items.some((it) => isActive(it.url)));
          if (collapsed) {
            const allItems = [
              ...(g.items || []),
              ...(g.subgroups?.flatMap((sg) => sg.items) || []),
            ];
            return (
              <SidebarGroup key={g.label}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {allItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <Link to={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 shrink-0" />
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }
          return (
            <Collapsible
              key={g.label}
              defaultOpen={groupActive}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
                    <g.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                    <span className="truncate">{g.label}</span>
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarGroupContent>
                    {g.subgroups?.map((sg) => {
                      const subActive = sg.items.some((it) => isActive(it.url));
                      return (
                        <Collapsible key={sg.label} defaultOpen={subActive} className="group/subcollapsible">
                          <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
                              <sg.icon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" />
                              <span className="truncate">{sg.label}</span>
                            </CollapsibleTrigger>
                          </SidebarGroupLabel>
                          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                            <div className="relative ms-3 ps-3 border-s border-sidebar-border/60">
                              <SidebarMenu>
                                {sg.items.map((item) => (
                                  <SidebarMenuItem key={item.url} className="relative">
                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-px w-2.5 bg-sidebar-border/60 start-[-12px]"
                                    />
                                    <SidebarMenuButton
                                      asChild
                                      isActive={isActive(item.url)}
                                      tooltip={item.title}
                                      className="gap-2"
                                    >
                                      <Link to={item.url} className="flex items-center gap-2">
                                        <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
                                        <span className="truncate">{item.title}</span>
                                      </Link>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                ))}
                              </SidebarMenu>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {g.items && (
                      <div className="relative ms-3 ps-3 border-s border-sidebar-border/60">
                        <SidebarMenu>
                          {g.items.map((item) => (
                            <SidebarMenuItem key={item.url} className="relative">
                              <span
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-px w-2.5 bg-sidebar-border/60 start-[-12px]"
                              />
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(item.url)}
                                tooltip={item.title}
                                className="gap-2"
                              >
                                <Link to={item.url} className="flex items-center gap-2">
                                  <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
                                  <span className="truncate">{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </div>
                    )}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
