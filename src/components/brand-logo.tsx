import { useI18n } from "@/i18n";
import { useBrandIdentity, type BrandIdentity } from "@/lib/brand-identity";

type Props = {
  size?: number;
  showWordmark?: boolean;
  variant?: "light" | "dark"; // light = for dark backgrounds (white text)
  className?: string;
  /** Override active identity — used for previews in settings */
  identity?: BrandIdentity;
};

/**
 * Al Hayat Financial ERP — bilingual brand lock-up.
 * Mark visuals come from the active brand identity (see lib/brand-identity).
 */
export function BrandLogo({
  size = 40,
  showWordmark = true,
  variant = "dark",
  className = "",
  identity: identityOverride,
}: Props) {
  const { locale } = useI18n();
  const { identity: active } = useBrandIdentity();
  const identity = identityOverride ?? active;
  const isLight = variant === "light";
  const titleColor = isLight ? "text-white" : "";
  const subColor = isLight ? "text-white/60" : "text-slate-500";
  const dividerColor = isLight ? "bg-white/15" : "bg-slate-200";
  const enColor = isLight ? "text-white/90" : "text-slate-500";
  const enSubColor = isLight ? "text-white/50" : "text-slate-500";

  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <BrandMark size={size} identity={identity} />
      {showWordmark && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span
              className={`text-[15px] font-bold tracking-tight ${titleColor}`}
              style={{
                fontFamily: identity.arabicFont,
                color: isLight ? undefined : identity.titleColor,
              }}
            >
              الحياة المالية
            </span>
            <span
              className={`text-[10px] font-light ${subColor}`}
              style={{ fontFamily: identity.arabicFont }}
            >
              نظام مالي متكامل
            </span>
          </div>
          <div className={`w-px h-7 ${dividerColor}`} aria-hidden />
          <div className="flex flex-col leading-tight">
            <span
              className={`text-[15px] font-semibold tracking-tight ${enColor}`}
              style={{ fontFamily: identity.latinFont }}
            >
              Al Hayat
            </span>
            <span
              className={`text-[9px] font-bold uppercase tracking-[0.18em] ${enSubColor}`}
              style={{ fontFamily: identity.latinFont }}
            >
              Financial ERP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type MarkProps = { size?: number; identity?: BrandIdentity };

export function BrandMark({ size = 40, identity: identityOverride }: MarkProps) {
  const { identity: active } = useBrandIdentity();
  const identity = identityOverride ?? active;
  return (
    <div
      className="relative shrink-0 rounded-xl flex items-center justify-center shadow-lg"
      style={{
        width: size,
        height: size,
        background: identity.markBg,
        boxShadow: identity.markGlow,
      }}
      aria-label="Al Hayat Financial ERP"
    >
      <svg
        viewBox="0 0 100 100"
        width={size * 0.62}
        height={size * 0.62}
        fill={identity.glyphColor}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Two ascending columns */}
        <path d="M30 25h10v50H30zM60 25h10v50H60z" />
        {/* Ledger bridge */}
        <path d="M35 45h30v10H35z" />
        {/* Ascending arc — growth / life */}
        <path d="M70 75c-15 0-25-10-25-10l5-5s5 5 20 5z" />
      </svg>
    </div>
  );
}
