import { useI18n } from "@/i18n";

type Props = {
  size?: number;
  showWordmark?: boolean;
  variant?: "light" | "dark"; // light = for dark backgrounds (white text)
  className?: string;
};

/**
 * Al Hayat Financial ERP — brand mark
 * Concept: a navy shield monogram "H" formed by two ascending columns
 * (growth bars) bridged by a gold bar (bullion / ledger line).
 * Inspired by global finance identities (JPM, GS, HSBC) — navy + gold.
 */
export function BrandLogo({ size = 36, showWordmark = true, variant = "dark", className = "" }: Props) {
  const { t, locale } = useI18n();
  const fg = variant === "light" ? "text-white" : "text-foreground";
  const sub = variant === "light" ? "text-white/70" : "text-muted-foreground";

  return (
    <div className={`flex items-center gap-3 ${className}`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <BrandMark size={size} />
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span className={`text-[15px] font-bold tracking-tight ${fg}`}>
            {locale === "ar" ? "الحياة المالية" : "Al Hayat"}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${sub}`}>
            {locale === "ar" ? "نظام مالي متكامل" : "Financial ERP"}
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Al Hayat Financial ERP"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="ah-navy" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E2A55" />
          <stop offset="100%" stopColor="#0A1B38" />
        </linearGradient>
        <linearGradient id="ah-gold" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E6C46A" />
          <stop offset="50%" stopColor="#C9A24B" />
          <stop offset="100%" stopColor="#9E7B2E" />
        </linearGradient>
      </defs>

      {/* Shield / rounded square */}
      <path
        d="M8 6 H40 A2 2 0 0 1 42 8 V32 C42 38 36 44 24 46 C12 44 6 38 6 32 V8 A2 2 0 0 1 8 6 Z"
        fill="url(#ah-navy)"
      />

      {/* Monogram H — two ascending columns */}
      <rect x="14" y="14" width="5" height="22" rx="1" fill="#FFFFFF" />
      <rect x="29" y="10" width="5" height="26" rx="1" fill="#FFFFFF" />

      {/* Gold bar bridging — ledger / bullion */}
      <rect x="14" y="22" width="20" height="4" rx="1" fill="url(#ah-gold)" />

      {/* Subtle ascent dot */}
      <circle cx="34.5" cy="9" r="1.8" fill="url(#ah-gold)" />
    </svg>
  );
}
