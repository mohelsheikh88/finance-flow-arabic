import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { useVisibleNavGroups, groupHomeUrl } from "@/lib/nav-config";
import { BrandMark } from "@/components/brand-logo";
import { ModuleCardGrid } from "@/components/module-card-grid";

export const Route = createFileRoute("/_authenticated/apps")({
  component: AppsLauncher,
});

function AppsLauncher() {
  const { t } = useI18n();
  const groups = useVisibleNavGroups();

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-10 sm:py-14">
      <div className="flex items-center gap-4 sm:gap-5 mb-10 sm:mb-14 max-w-full px-4" dir="ltr">
        <BrandMark size={64} />
        <span className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
          {t("common.appWordmark")}
        </span>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 text-center">
        {t("nav.apps")}
      </h1>
      <p className="text-[13px] text-white/55 mb-8 text-center">
        {t("common.chooseModuleToStart")}
      </p>

      <ModuleCardGrid
        items={groups.map((g) => ({ label: g.label, icon: g.icon, hue: g.hue, url: groupHomeUrl(g) }))}
      />
    </div>
  );
}
