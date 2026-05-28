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
      label: t("nav.accounting"),
      items: [
        { url: "/customers", icon: Users, title: t("nav.customers") },
        { url: "/partners", icon: Users, title: t("nav.partners") },
        { url: "/invoices/customer", icon: FileText, title: t("nav.customerInvoices") },
        { url: "/invoices/vendor", icon: Receipt, title: t("nav.vendorBills") },
        { url: "/payments", icon: Wallet, title: t("nav.payments") },
        { url: "/banks", icon: Landmark, title: t("nav.banks") },
        { url: "/assets", icon: Briefcase, title: t("nav.assets") },
        { url: "/loans", icon: CreditCard, title: t("nav.loans") },
      ],
    },
    {
      label: t("nav.gl"),
      items: [
        { url: "/journal-entries", icon: BookOpen, title: t("nav.journalEntries") },
        { url: "/trial-balance", icon: Calculator, title: t("nav.trialBalance") },
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
        { url: "/accounts", icon: BookOpen, title: t("nav.chartOfAccounts") },
        { url: "/cost-centers", icon: Wallet, title: t("nav.costCenters") },
        { url: "/journals", icon: BookOpen, title: t("nav.journals") },
        { url: "/taxes", icon: Receipt, title: t("nav.taxes") },
        { url: "/currencies", icon: Coins, title: t("nav.currencies") },
        { url: "/fiscal-periods", icon: CalendarRange, title: t("nav.fiscalPeriods") },
        { url: "/companies", icon: Building2, title: t("nav.companies") },
        { url: "/users", icon: Users, title: t("nav.users") },
        { url: "/settings", icon: Settings, title: t("nav.settings") },
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
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
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
