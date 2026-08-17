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

      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-8 text-center">
        {t("nav.apps")}
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5 w-full max-w-3xl">
        {groups.map((g) => (
          <Link
            key={g.label}
            to={groupHomeUrl(g)}
            className="group flex flex-col items-center justify-center gap-3 aspect-square rounded-2xl p-4 sm:p-6
                       bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.07]
                       shadow-sm transition-all duration-200 ease-out
                       hover:from-white/[0.10] hover:to-white/[0.02] hover:border-primary/30
                       hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(0,0,0,0.35)]
                       active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl
                             bg-black/25 border border-white/[0.06] shadow-inner
                             transition-all duration-200 group-hover:bg-black/35 group-hover:border-primary/25">
              <g.icon className="h-7 w-7 sm:h-8 sm:w-8 text-foreground/85 transition-transform duration-200 group-hover:scale-105" />
            </div>
            <span className="text-[13px] sm:text-sm font-semibold text-center text-foreground/90 leading-tight">
              {g.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
