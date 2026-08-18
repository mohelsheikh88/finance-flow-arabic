import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { ModuleCardGrid } from "@/components/module-card-grid";

export const Route = createFileRoute("/_authenticated/module/$key")({
  component: ModuleSubLauncher,
});

/**
 * Generic "pick a section" screen for any module that has subgroups.
 * Works for Financial Accounting, Medical App, and any future module —
 * nothing here is hard-coded to a specific module key.
 */
function ModuleSubLauncher() {
  const { key } = Route.useParams();
  const { t } = useI18n();
  const groups = useNavGroups();
  const group = groups.find((g) => g.key === key);
  const subgroups = group?.subgroups ?? [];

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-10 sm:py-14">
      <Link
        to="/apps"
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 mb-6 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>{t("nav.homeScreen")}</span>
      </Link>

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
  );
}
