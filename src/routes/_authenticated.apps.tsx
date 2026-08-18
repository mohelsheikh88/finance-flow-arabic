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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6 w-full max-w-4xl">
        {groups.map((g) => (
          <Link
            key={g.label}
            to={groupHomeUrl(g)}
            style={{ ["--hue" as any]: g.hue }}
            className="group flex flex-col items-center justify-center gap-4 aspect-square rounded-3xl p-6 sm:p-8
                       bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.10]
                       shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm
                       transition-all duration-200 ease-out
                       hover:from-white/[0.13] hover:to-white/[0.03] hover:border-[hsl(var(--hue)_85%_60%/0.45)]
                       hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(0,0,0,0.6)]
                       active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--hue)_85%_60%/0.5)]"
          >
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl
                             bg-[hsl(var(--hue)_75%_50%/0.16)] border border-[hsl(var(--hue)_80%_60%/0.28)] shadow-inner
                             transition-all duration-200 group-hover:bg-[hsl(var(--hue)_75%_50%/0.24)] group-hover:border-[hsl(var(--hue)_80%_60%/0.45)]">
              <g.icon className="h-9 w-9 sm:h-11 sm:w-11 text-[hsl(var(--hue)_88%_68%)] transition-transform duration-200 group-hover:scale-110" />
            </div>
            <span className="text-[15px] sm:text-base font-bold text-center text-white/95 leading-tight">
              {g.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
