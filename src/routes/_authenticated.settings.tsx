import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";
import { useBrandIdentity, type BrandIdentity } from "@/lib/brand-identity";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
          خصّص مظهر التطبيق والهوية البصرية حسب تفضيلاتك.
        </p>
      </header>

      <BrandIdentitySection />
    </div>
  );
}

function BrandIdentitySection() {
  const { id, setIdentity, all } = useBrandIdentity();

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-lg font-semibold">هوية العلامة التجارية</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        اختر الهوية البصرية التي تظهر في الشريط الجانبي وصفحة الدخول. يتم الحفظ فورًا.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {all.map((identity) => (
          <IdentityCard
            key={identity.id}
            identity={identity}
            selected={identity.id === id}
            onSelect={() => {
              setIdentity(identity.id);
              toast.success(`تم تطبيق هوية: ${identity.nameAr}`);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function IdentityCard({
  identity,
  selected,
  onSelect,
}: {
  identity: BrandIdentity;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative text-start rounded-2xl overflow-hidden border bg-card",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        selected
          ? "border-primary ring-2 ring-primary/40 shadow-lg"
          : "border-border hover:border-primary/40"
      )}
    >
      {/* Selected badge */}
      {selected && (
        <div className="absolute top-3 end-3 z-10 flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[10px] font-semibold shadow">
          <Check className="size-3" />
          مُفعّلة
        </div>
      )}

      {/* Dark preview */}
      <div
        className="relative p-6 pb-5 flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, #1a0b2e 0%, #100720 60%, #0a0512 100%)",
        }}
      >
        <BrandLogo size={42} variant="light" identity={identity} />
      </div>

      {/* Light preview */}
      <div className="bg-background p-5 border-t flex items-center justify-between gap-3">
        <BrandMark size={36} identity={identity} />
        <div className="flex flex-col items-end leading-tight flex-1">
          <span
            className="text-sm font-bold"
            style={{ fontFamily: identity.arabicFont, color: identity.titleColor }}
          >
            الحياة المالية
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: identity.latinFont, color: identity.accentColor }}
          >
            Financial ERP
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="p-4 border-t bg-muted/30 space-y-3">
        <div>
          <div className="text-sm font-semibold">{identity.nameAr}</div>
          <div className="text-[11px] text-muted-foreground">{identity.nameEn}</div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {identity.taglineAr}
        </p>
        <div className="flex items-center gap-1.5 pt-1">
          {identity.swatches.map((c) => (
            <span
              key={c}
              className="size-4 rounded-full ring-1 ring-black/10 dark:ring-white/10"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </button>
  );
}
