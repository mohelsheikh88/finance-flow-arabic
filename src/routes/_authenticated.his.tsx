import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { ModuleCardGrid } from "@/components/module-card-grid";

export const Route = createFileRoute("/_authenticated/his")({
  component: MedicalAppLauncher,
});

function MedicalAppLauncher() {
  const { t } = useI18n();
  const groups = useNavGroups();
  const medical = groups.find((g) => g.key === "his");
  const subItems = medical?.subgroups ?? [];

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-10 sm:py-14">
      <Link
        to="/apps"
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 mb-6 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>{t("nav.backToApps")}</span>
      </Link>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 text-center">
        {medical?.label}
      </h1>
      <p className="text-[13px] text-white/55 mb-8 text-center">
        {t("common.chooseModuleToStart")}
      </p>

      <ModuleCardGrid
        items={subItems.map((sg) => ({
          label: sg.label,
          icon: sg.icon,
          hue: sg.hue ?? 351,
          url: sg.items[0].url,
        }))}
      />
    </div>
  );
}
