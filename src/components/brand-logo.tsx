import { useI18n } from "@/i18n";

type Props = {
  size?: number;
  showWordmark?: boolean;
  variant?: "light" | "dark"; // light = for dark backgrounds (white text)
  className?: string;
};

/**
 * Al Hayat Financial ERP — brand mark (Modern Magenta Ascent)
 * Concept: two ascending columns (growth bars) bridged by a ledger line,
 * with an ascending arc symbolizing growth and life ("الحياة").
 * Palette: deep purple (#1a0b2e / #2d0d44) + radial magenta (#f06292 → #d63384).
 */
export function BrandLogo({ size = 40, showWordmark = true, variant = "dark", className = "" }: Props) {
  const { locale } = useI18n();
  const isLight = variant === "light";
  const titleColor = isLight ? "text-white" : "text-[#2d0d44]";
  const subColor = isLight ? "text-white/60" : "text-slate-500";
  const dividerColor = isLight ? "bg-white/15" : "bg-slate-200";
  const enColor = isLight ? "text-white/90" : "text-slate-500";
  const enSubColor = isLight ? "text-white/50" : "text-slate-500";

  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <BrandMark size={size} />
      {showWordmark && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className={`text-[15px] font-bold tracking-tight ${titleColor}`} style={{ fontFamily: "Cairo, system-ui, sans-serif" }}>
              {locale === "ar" ? "الحياة المالية" : "الحياة المالية"}
            </span>
            <span className={`text-[10px] font-light ${subColor}`} style={{ fontFamily: "Cairo, system-ui, sans-serif" }}>
              نظام مالي متكامل
            </span>
          </div>
          <div className={`w-px h-7 ${dividerColor}`} aria-hidden />
          <div className="flex flex-col leading-tight">
            <span className={`text-[15px] font-semibold tracking-tight ${enColor}`} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
              Al Hayat
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${enSubColor}`} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
              Financial ERP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-xl flex items-center justify-center shadow-lg"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 30% 30%, #f06292 0%, #d63384 100%)",
        boxShadow: "0 8px 24px -8px rgba(214, 51, 132, 0.45)",
      }}
      aria-label="Al Hayat Financial ERP"
    >
      <svg
        viewBox="0 0 100 100"
        width={size * 0.62}
        height={size * 0.62}
        fill="white"
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
