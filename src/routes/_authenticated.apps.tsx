import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { useVisibleNavGroups, groupHomeUrl } from "@/lib/nav-config";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/apps")({
  component: AppsLauncher,
});

function AppsLauncher() {
  const { t } = useI18n();
  const groups = useVisibleNavGroups();

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-10 sm:py-14">
      <div className="mb-10 sm:mb-14">
        <BrandLogo size={48} variant="light" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 text-center">
        {t("nav.apps")}
      </h1>
      <p className="text-[13px] text-white/55 mb-8 text-center">
        {t("common.chooseModuleToStart")}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 w-full max-w-3xl">
        {groups.map((g) => (
          <Link
            key={g.label}
            to={groupHomeUrl(g)}
            className="group flex flex-col items-center justify-center gap-3 aspect-square rounded-2xl p-4 sm:p-6
                       bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.10]
                       shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm
                       transition-all duration-200 ease-out
                       hover:from-white/[0.13] hover:to-white/[0.03] hover:border-[hsl(158,90%,55%)]/40
                       hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_rgba(0,0,0,0.55)]
                       active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(158,90%,55%)]/50"
          >
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl
                             bg-black/25 border border-white/[0.08] shadow-inner
                             transition-all duration-200 group-hover:bg-black/35 group-hover:border-[hsl(158,90%,55%)]/30">
              <g.icon className="h-7 w-7 sm:h-8 sm:w-8 text-white/85 transition-transform duration-200 group-hover:scale-105 group-hover:text-[hsl(158,90%,70%)]" />
            </div>
            <span className="text-[13px] sm:text-sm font-semibold text-center text-white/90 leading-tight">
              {g.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
