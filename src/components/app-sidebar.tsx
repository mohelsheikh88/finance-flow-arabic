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
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
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
import { useVisibleNavGroups, matchNavPath, groupHomeUrl } from "@/lib/nav-config";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { t, locale } = useI18n();
  const { signOut } = useAuth();
  const groups = useVisibleNavGroups();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p + "/");

  // Odoo-style: the sidebar only ever shows the ONE module the user is
  // currently inside. Fall back to the first visible module if, for some
  // reason, the current path doesn't belong to any of them yet.
  const match = matchNavPath(groups, currentPath);
  const activeGroup = match?.group ?? groups[0];

  // Some top-level apps (e.g. "Medical App") are themselves just a card-grid
  // launcher for several independent sub-modules (Pharmacy, Insurance...).
  // Once the user is actually inside one of those sub-modules, the sidebar
  // should scope to THAT sub-module only — not list its siblings too.
  // Same principle for EVERY module that has subgroups (Accounting, Medical
  // App, and any future one): once the user is inside a specific subgroup's
  // page, the sidebar scopes to that subgroup only, and "Back" steps up to
  // this module's own card-grid sub-launcher — not straight to /apps.
  const isNestedApp = !!(activeGroup?.subgroups && activeGroup.subgroups.length > 0 && match?.subgroup);
  const ScopeIcon = isNestedApp ? match!.subgroup!.icon : activeGroup?.icon;
  const scopeLabel = isNestedApp ? match!.subgroup!.label : activeGroup?.label;
  const scopeItems = isNestedApp ? match!.subgroup!.items : activeGroup?.items;
  const scopeSubgroups = isNestedApp ? undefined : activeGroup?.subgroups;
  const backUrl = isNestedApp && activeGroup ? groupHomeUrl(activeGroup) : "/apps";
  // "Back" always names its actual destination instead of a generic word —
  // stepping out of a sub-module names the parent module; from a flat
  // module it goes to the main launcher, same as Home Screen.
  const backLabel = isNestedApp && activeGroup ? activeGroup.label : t("nav.allApps");
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;



  return (
    <Sidebar collapsible="icon" side={locale === "ar" ? "right" : "left"} className={locale === "ar" ? "border-l" : "border-r"}>

      <SidebarHeader className="overflow-visible border-b border-sidebar-border/60">
        <div className="relative flex items-center justify-center px-2 py-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <SidebarMenuButton asChild tooltip={t("nav.homeScreen")} className="mx-auto">
                <Link to="/apps" viewTransition className="flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 shrink-0" />
                </Link>
              </SidebarMenuButton>
              <SidebarMenuButton asChild tooltip={backLabel} className="mx-auto">
                <Link to={backUrl} viewTransition className="flex items-center justify-center">
                  <BackIcon className="h-5 w-5 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </div>
          ) : (
            <div className="flex items-stretch gap-2 w-full">
              <Link
                to="/apps"
                viewTransition
                className="flex-1 flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5
                           bg-[hsl(158,70%,45%)]/[0.12] border border-[hsl(158,70%,50%)]/25
                           text-[hsl(158,85%,72%)] hover:bg-[hsl(158,70%,45%)]/[0.20] hover:border-[hsl(158,70%,50%)]/40
                           transition-colors"
              >
                <LayoutGrid className="h-6 w-6" />
                <span className="text-[11.5px] font-bold tracking-tight leading-none">{t("nav.homeScreen")}</span>
              </Link>

              <Link
                to={backUrl}
                viewTransition
                className="flex-1 flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5
                           bg-white/[0.04] border border-white/[0.08]
                           text-sidebar-foreground/75 hover:bg-white/[0.08] hover:text-sidebar-foreground hover:border-white/[0.14]
                           transition-colors"
              >
                <BackIcon className="h-6 w-6" />
                <span className="text-[11.5px] font-bold tracking-tight leading-none truncate max-w-full px-1">{backLabel}</span>
              </Link>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overflow-x-hidden px-2 sm:px-3">
        {/* ===== Active module only ===== */}
        {activeGroup && (collapsed ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {[
                  ...(scopeItems || []),
                  ...(scopeSubgroups?.flatMap((sg) => sg.items) || []),
                ].map((item) => (
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
        ) : (
          <SidebarGroup className="sidebar-grandparent mb-1.5 p-0">
            {/* Static module header (always "open" — no need to collapse the only module shown) */}
            <div className="relative flex items-center gap-2.5 sm:gap-3 rounded-xl p-2.5 sm:p-3 mb-1.5 bg-gradient-to-br from-white/[0.09] to-white/[0.02] border border-sidebar-primary/25 shadow-sm">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-black/30 border border-white/[0.06] shadow-inner">
                <ScopeIcon className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] text-sidebar-foreground/80" />
              </div>
              <span className="flex-1 min-w-0 truncate text-start text-[15.5px] sm:text-[17px] font-bold tracking-tight text-white/90">
                {scopeLabel}
              </span>
            </div>

            <SidebarGroupContent className="relative ms-2 ps-2 sm:ms-3 sm:ps-3 border-s border-dashed border-sidebar-border/70">
              {scopeSubgroups?.map((sg) => {
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
                          className="flex h-auto w-full cursor-pointer items-center gap-2 px-2 py-1.5 rounded-lg text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
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
              {scopeItems && (
                <SidebarMenu>
                  {scopeItems.map((item) => (
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
          </SidebarGroup>
        ))}
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
