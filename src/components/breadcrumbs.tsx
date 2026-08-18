import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNavGroups, matchNavPath, groupHomeUrl } from "@/lib/nav-config";

/**
 * Shows the current navigation path at the top of the screen, e.g.
 * الرئيسية > الحسابات المالية > التقارير > الميزانية العمومية
 * Every crumb (except the current page) is a real link, so it can be
 * opened in a new tab / right-clicked like any other navigation link.
 */
export function Breadcrumbs() {
  const { t, dir } = useI18n();
  const groups = useNavGroups();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  const match = matchNavPath(groups, pathname);

  // On the bare root/dashboard with no deeper match, still show "Home" alone.
  if (!match) {
    return (
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 h-8 px-3 text-[12.5px] text-muted-foreground border-b bg-card/50 shrink-0"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{t("nav.mainDashboard")}</span>
      </nav>
    );
  }

  const { group, subgroup, item } = match;
  const groupUrl = groupHomeUrl(group);
  const subgroupUrl = subgroup?.items[0]?.url ?? groupUrl;

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1.5 h-8 px-3 text-[12.5px] text-muted-foreground border-b bg-card/50 shrink-0 overflow-x-auto whitespace-nowrap"
    >
      <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>

      <Chevron className="h-3 w-3 shrink-0 opacity-50" />

      <Link to={groupUrl} className="hover:text-foreground transition-colors shrink-0">
        {group.label}
      </Link>

      {subgroup && (
        <>
          <Chevron className="h-3 w-3 shrink-0 opacity-50" />
          <Link to={subgroupUrl} className="hover:text-foreground transition-colors shrink-0">
            {subgroup.label}
          </Link>
        </>
      )}

      <Chevron className="h-3 w-3 shrink-0 opacity-50" />

      <span className="text-foreground font-semibold shrink-0">{item.title}</span>
    </nav>
  );
}
