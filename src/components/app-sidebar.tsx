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
  Activity,
  ShieldCheck,
  Lock,
  History,
  HandCoins,
  ShoppingCart,
  ShoppingBag,
  Package,
  UsersRound,
  BarChart3,
  SlidersHorizontal,
  Pin,

  PinOff,
  LogOut,
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

type AppSidebarProps = {
  pinned?: boolean;
  onTogglePin?: () => void;
};

export function AppSidebar({ pinned = true, onTogglePin }: AppSidebarProps = {}) {
  const { t, locale } = useI18n();
  const { signOut } = useAuth();
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
      label: t("nav.purchaseProcurement"),
      icon: ShoppingBag,
      items: [
        { url: "/purchase", icon: ShoppingBag, title: t("common.willBeBuiltLater") },
      ],
    },
    {
      label: t("nav.inventoryManagement"),
      icon: Package,
      items: [
        { url: "/inventory", icon: Package, title: t("common.willBeBuiltLater") },
      ],
    },
    {
      label: t("nav.humanResources"),
      icon: UsersRound,
      items: [
        { url: "/hr", icon: UsersRound, title: t("common.willBeBuiltLater") },
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

      <SidebarHeader className="overflow-visible border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          {/* Glass-morphism logo container */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[hsl(327,92%,55%)]/40 to-[hsl(280,70%,55%)]/30 blur-md opacity-70" />
            <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] ring-1 ring-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg">
              {collapsed ? <BrandMark size={26} /> : <BrandMark size={26} />}
            </div>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <BrandLogo size={28} variant="light" />
              </div>
              {onTogglePin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onTogglePin}
                  aria-label={pinned ? t("common.unpin") : t("common.pin")}
                  title={pinned ? t("common.unpin") : t("common.pin")}
                  className={
                    "h-8 w-8 shrink-0 rounded-md transition-all " +
                    (pinned
                      ? "bg-[hsl(263,55%,32%)]/35 text-[hsl(280,80%,75%)] ring-1 ring-[hsl(327,92%,60%)]/40 hover:bg-[hsl(263,55%,32%)]/55"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40")
                  }
                >
                  {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overflow-x-hidden px-2 sm:px-3">
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
              <SidebarGroup className="sidebar-grandparent mb-1.5">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger
                    className={
                      "group/trigger relative flex h-auto w-full cursor-pointer items-center justify-between gap-2.5 sm:gap-3 rounded-xl p-2.5 sm:p-3 " +
                      "bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.06] shadow-lg " +
                      "transition-all duration-300 ease-out " +
                      "hover:from-white/[0.10] hover:to-white/[0.02] hover:border-[hsl(327,92%,60%)]/30 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.35)] " +
                      "active:from-white/[0.12] active:to-white/[0.03] active:border-[hsl(327,92%,60%)]/40 active:scale-[0.99] " +
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(327,92%,60%)]/40 " +
                      (groupActive ? "from-white/[0.09] to-white/[0.02] border-[hsl(327,92%,60%)]/30" : "")
                    }
                  >
                    {/* Accent bar (active) */}
                    <span
                      aria-hidden
                      className={
                        "pointer-events-none absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-[hsl(327,92%,60%)] shadow-[0_0_8px_hsl(327,92%,60%)/0.7] transition-opacity duration-300 " +
                        (groupActive ? "opacity-100" : "opacity-0 group-hover/trigger:opacity-100 group-active/trigger:opacity-100 group-data-[state=open]/collapsible:opacity-100")
                      }
                    />
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      {/* Icon well */}
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-black/35 border border-white/[0.08] shadow-inner transition-all duration-300 group-hover/trigger:border-[hsl(327,92%,60%)]/30 group-hover/trigger:bg-black/50 group-active/trigger:border-[hsl(327,92%,60%)]/40 group-active/trigger:bg-black/50">
                        <g.icon className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] text-[hsl(327,92%,72%)] transition-transform duration-500 ease-out group-hover/trigger:-translate-y-0.5 group-hover/trigger:scale-105 group-active/trigger:scale-105" />
                      </div>
                      <span className="flex-1 min-w-0 truncate text-start text-[14.5px] sm:text-[16px] font-bold tracking-tight text-white/90">
                        {g.label}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-visible data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarGroupContent className="relative ms-2 ps-2 sm:ms-3 sm:ps-3 border-s border-dashed border-sidebar-border/70">
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
                              <CollapsibleTrigger
                                className="nav-pill flex h-auto w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sidebar-foreground/80"
                              >
                                <sg.icon className="h-[16px] w-[16px] shrink-0 text-[hsl(327,80%,68%)]/90" />
                                <span className="flex-1 whitespace-nowrap text-start">{sg.label}</span>
                              </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            <CollapsibleContent className="overflow-visible data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                              <div className="relative ms-2 ps-2 sm:ms-3 sm:ps-3 border-s border-sidebar-border/60">
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
                                        className="nav-pill h-9 gap-2.5 text-[13.5px]"
                                      >
                                        <Link to={item.url} className="flex items-center gap-2.5">
                                          <item.icon className="h-[15px] w-[15px] shrink-0 text-sidebar-foreground/70" />
                                          <span className="whitespace-nowrap">{item.title}</span>
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
                              className="nav-pill h-9 gap-2.5 text-[13.5px]"
                            >
                              <Link to={item.url} className="flex items-center gap-2.5">
                                <item.icon className="h-[15px] w-[15px] shrink-0 text-sidebar-foreground/70" />
                                <span className="whitespace-nowrap">{item.title}</span>
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

      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => signOut()}
          className="w-full justify-start gap-2.5 h-10 rounded-md text-sidebar-foreground/80 hover:text-white hover:bg-gradient-to-r hover:from-[hsl(327,80%,40%)]/40 hover:to-[hsl(263,60%,26%)]/40"
          aria-label={t("auth.signOut")}
          title={t("auth.signOut")}
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" />
          {!collapsed && <span className="whitespace-nowrap text-[13.5px] font-medium">{t("auth.signOut") || "Logout"}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
