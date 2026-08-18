import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { useVisibleNavGroups, groupHomeUrl } from "@/lib/nav-config";
import { BrandMark } from "@/components/brand-logo";

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

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-3.5 w-full max-w-4xl">
        {groups.map((g) => (
          <Link
            key={g.label}
            to={groupHomeUrl(g)}
            style={{ ["--hue" as any]: g.hue }}
            className="group flex flex-col items-center justify-center gap-2 aspect-square overflow-hidden rounded-2xl p-3 sm:p-3.5
                       bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.10]
                       shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm
                       transition-all duration-200 ease-out
                       hover:from-white/[0.13] hover:to-white/[0.03] hover:border-[hsl(var(--hue)_85%_60%/0.45)]
                       hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(0,0,0,0.6)]
                       active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--hue)_85%_60%/0.5)]"
          >
            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center">
              {/* Ambient colored glow — pure light, no visible edge/shape */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-lg opacity-60 transition-opacity duration-200 group-hover:opacity-90"
                style={{ background: "radial-gradient(circle, hsl(var(--hue) 85% 55% / 0.4), transparent 70%)" }}
              />
              {/* Glossy top highlight — simulates a light source for depth */}
              <div
                aria-hidden
                className="absolute top-1 inset-x-2.5 h-1/2 rounded-full blur-md opacity-35 pointer-events-none"
                style={{ background: "radial-gradient(ellipse, white, transparent 72%)" }}
              />
              <g.icon
                strokeWidth={1.6}
                className="relative h-14 w-14 sm:h-16 sm:w-16 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
                style={{
                  color: "hsl(var(--hue) 90% 70%)",
                  filter:
                    "drop-shadow(0 2px 3px hsl(var(--hue) 85% 30% / 0.6)) drop-shadow(0 10px 20px hsl(var(--hue) 85% 45% / 0.5))",
                }}
              />
            </div>
            <span className="text-[13px] sm:text-sm font-bold text-center text-white/95 leading-tight line-clamp-2" title={g.label}>
              {g.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
