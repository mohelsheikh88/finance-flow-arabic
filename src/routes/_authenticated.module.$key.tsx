import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNavGroups, useVisibleNavGroups, groupHomeUrl } from "@/lib/nav-config";
import { ModuleCardGrid } from "@/components/module-card-grid";
import { BrandMark } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/module/$key")({
  component: ModuleSubLauncher,
});

/**
 * Generic "pick a section" screen for any module that has subgroups.
 * Renders as a professional glass popup floating over a dimmed, blurred
 * copy of the Home Screen — a clear visual cue that this is one level
 * "into" a module, not a brand new top-level page. Works for Financial
 * Accounting, Medical App, and any future module — nothing here is
 * hard-coded to a specific module key.
 */
function ModuleSubLauncher() {
  const { key } = Route.useParams();
  const { t } = useI18n();
  const groups = useNavGroups();
  const backgroundGroups = useVisibleNavGroups();
  const group = groups.find((g) => g.key === key);
  const subgroups = group?.subgroups ?? [];

  return (
    <div className="relative min-h-full">
      {/* ===== Dimmed, blurred "Home Screen" showing through behind the popup ===== */}
      <div
        aria-hidden
        className="absolute inset-0 flex flex-col items-center px-6 py-10 sm:py-14 pointer-events-none select-none opacity-35 blur-[3px] scale-[1.03]"
      >
        <div className="flex items-center gap-4 mb-10" dir="ltr">
          <BrandMark size={64} />
          <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t("common.appWordmark")}
          </span>
        </div>
        <ModuleCardGrid
          items={backgroundGroups.map((g) => ({ label: g.label, icon: g.icon, hue: g.hue, url: groupHomeUrl(g) }))}
        />
      </div>

      {/* ===== Dark scrim to dim the background further ===== */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* ===== The popup itself ===== */}
      <div className="relative z-10 min-h-full flex items-center justify-center p-4 sm:p-8">
        <div
          className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/[0.14]
                     bg-white/[0.08] backdrop-blur-2xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)]
                     p-6 sm:p-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out"
        >
          <div className="flex items-start justify-between gap-4 mb-1.5">
            <Link
              to="/apps"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{t("nav.homeScreen")}</span>
            </Link>
            <Link
              to="/apps"
              aria-label={t("nav.homeScreen")}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 text-center">
            {group?.label}
          </h1>
          <p className="text-[13px] text-white/55 mb-8 text-center">
            {t("common.chooseModuleToStart")}
          </p>

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
