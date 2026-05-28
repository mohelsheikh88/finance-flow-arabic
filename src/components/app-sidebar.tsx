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

  type NavItem = { url: string; icon: any; title: string };
  type NavGroup = { label: string; icon: any; items?: NavItem[]; subgroups?: { label: string; icon: any; items: NavItem[] }[] };
  const groups: NavGroup[] = [
    {
      label: t("nav.financialAccounting"),
      icon: Wallet,
      subgroups: [
        {
          label: t("nav.dashboard"),
          icon: LayoutDashboard,
          items: [
            { url: "/dashboard", icon: LayoutDashboard, title: t("nav.mainDashboard") },
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
            { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
            { url: "/payment-methods", icon: CreditCard, title: t("nav.paymentMethods") },
            { url: "/lock-dates", icon: Lock, title: t("nav.lockDates") },
            { url: "/approvals", icon: ShieldCheck, title: t("approvals.title") },
          ],
        },
      ],
    },
    {
      label: t("nav.generalSetting"),
      icon: Settings,
      items: [
        { url: "/companies", icon: Building2, title: t("nav.companiesBranches") },
        { url: "/users", icon: Users, title: t("nav.users") },
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
              <SidebarGroup className="sidebar-grandparent">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="group/trigger flex h-auto w-full cursor-pointer items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-sidebar-accent/50">
                    <g.icon className="h-[18px] w-[18px] shrink-0 text-[hsl(327,92%,72%)]" />
                    <span className="flex-1 truncate text-start">{g.label}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarGroupContent className="relative ms-3 ps-3 border-s border-dashed border-sidebar-border/70">
                    {g.subgroups?.map((sg) => {
                      const subActive = sg.items.some((it) => isActive(it.url));
                      return (
                        <Collapsible key={sg.label} defaultOpen={subActive} className="group/subcollapsible relative">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute top-5 h-px w-3 bg-sidebar-border/70 start-[-12px]"
                          />
                          <SidebarGroup className="sidebar-parent p-0">
                            <SidebarGroupLabel asChild>
                              <CollapsibleTrigger className="flex h-auto w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent/40">
                                <sg.icon className="h-[16px] w-[16px] shrink-0 text-[hsl(327,80%,68%)]/90" />
                                <span className="flex-1 truncate text-start">{sg.label}</span>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-180" />
                              </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="relative ms-3 ps-3 border-s border-sidebar-border/60">
                                <SidebarMenu>
                                  {sg.items.map((item) => (
                                    <SidebarMenuItem key={item.url} className="relative">
                                      <span
                                        aria-hidden
                                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-px w-3 bg-sidebar-border/60 start-[-12px]"
                                      />
                                      <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.url)}
                                        tooltip={item.title}
                                        className="h-9 gap-2.5 text-[13.5px]"
                                      >
                                        <Link to={item.url} className="flex items-center gap-2.5">
                                          <item.icon className="h-[15px] w-[15px] shrink-0 text-sidebar-foreground/70" />
                                          <span className="truncate">{item.title}</span>
                                        </Link>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              </div>
                            </CollapsibleContent>
                          </SidebarGroup>
                        </Collapsible>
                      );
                    })}
                    {g.items && (
                      <SidebarMenu>
                        {g.items.map((item) => (
                          <SidebarMenuItem key={item.url} className="relative">
                            <span
                              aria-hidden
                              className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-px w-3 bg-sidebar-border/70 start-[-12px]"
                            />
                            <SidebarMenuButton
                              asChild
                              isActive={isActive(item.url)}
                              tooltip={item.title}
                              className="h-9 gap-2.5 text-[13.5px]"
                            >
                              <Link to={item.url} className="flex items-center gap-2.5">
                                <item.icon className="h-[15px] w-[15px] shrink-0 text-sidebar-foreground/70" />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
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
