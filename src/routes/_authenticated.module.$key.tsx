import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useI18n } from "@/i18n";
import { useVisibleNavGroups } from "@/lib/nav-config";
import { ModuleCardGrid, transitionNameFor } from "@/components/module-card-grid";

export const Route = createFileRoute("/_authenticated/module/$key")({
  component: ModuleSubLauncher,
});

/**
 * Generic "pick a section" screen for any module that has subgroups.
 * Presented as a floating panel centered over the dimmed Home Screen
 * surface — like a dialog stepping in front of the Apps launcher —
 * instead of taking over the whole viewport. The clicked card still
 * visually morphs into this panel's hero header via the native View
 * Transitions API. Works for Financial Accounting, Medical App, and any
 * future module — nothing here is module-specific.
 */
function ModuleSubLauncher() {
  const { key } = Route.useParams();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = useVisibleNavGroups();
  const group = groups.find((g) => g.key === key);
  const subgroups = group?.subgroups ?? [];
  const GroupIcon = group?.icon;

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-8 sm:py-12">
      <div
        className="relative w-full max-w-3xl flex flex-col items-center
                   rounded-3xl border border-white/[0.08] bg-white/[0.045] backdrop-blur-xl
                   shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)]
                   px-5 py-7 sm:px-10 sm:py-10
                   animate-in fade-in zoom-in-95 duration-300"
      >
        <Link
          to="/apps"
          viewTransition
          className="self-start flex items-center gap-2 rounded-lg px-3 py-1.5 mb-6 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>{t("nav.homeScreen")}</span>
        </Link>

        {/* Hero header — this is the element the clicked card morphs into */}
        <div
          style={{ viewTransitionName: transitionNameFor(pathname), ["--hue" as any]: group?.hue ?? 200 }}
          className="flex items-center gap-3 sm:gap-4 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 mb-8 w-full sm:w-auto
                     bg-gradient-to-br from-white/[0.09] to-white/[0.02] border border-[hsl(var(--hue)_70%_55%/0.25)]
                     shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
        >
          {GroupIcon && (
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-black/25 border border-white/[0.06]">
              <GroupIcon className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: "hsl(var(--hue) 88% 68%)" }} />
            </div>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">{group?.label}</h1>
            <p className="text-[12.5px] text-white/55">{t("common.chooseModuleToStart")}</p>
          </div>
        </div>

        <div className="w-full flex justify-center">
          <ModuleCardGrid
            items={subgroups.map((sg) => ({
              label: sg.label,
              icon: sg.icon,
              hue: sg.hue ?? group?.hue ?? 200,
              url: sg.items[0].url,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
