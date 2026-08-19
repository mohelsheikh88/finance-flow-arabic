import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { HMG_IDENTITY } from "@/lib/brand-identity";
import { BrandLogo, BrandMark } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-muted-foreground text-sm">
          الهوية البصرية الرسمية المعتمدة للنظام.
        </p>
      </header>

      <BrandIdentitySection />
    </div>
  );
}

function BrandIdentitySection() {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <BadgeCheck className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">هوية العلامة التجارية</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        مأخوذة مباشرة من دليل الهوية البصرية الرسمي لشركة الحياة الطبية.
      </p>

      <div className="rounded-2xl overflow-hidden border bg-card max-w-md">
        {/* Dark preview */}
        <div className="relative p-6 pb-5 flex items-center justify-center bg-[#1a1c22]">
          <BrandLogo size={44} variant="light" />
        </div>

        {/* Light preview */}
        <div className="bg-background p-5 border-t flex items-center justify-center">
          <BrandLogo size={44} variant="dark" />
        </div>

        {/* Meta */}
        <div className="p-4 border-t bg-muted/30 space-y-3">
          <div>
            <div className="text-sm font-semibold">{HMG_IDENTITY.nameAr}</div>
            <div className="text-[11px] text-muted-foreground">{HMG_IDENTITY.nameEn}</div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {HMG_IDENTITY.swatches.map((c) => (
              <span
                key={c}
                className="size-6 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
