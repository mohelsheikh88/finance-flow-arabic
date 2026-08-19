import { useI18n } from "@/i18n";
import { useBrandIdentity } from "@/lib/brand-identity";

type Props = {
  size?: number;
  showWordmark?: boolean;
  variant?: "light" | "dark"; // light = for dark backgrounds (white text)
  className?: string;
};

/**
 * Hayat Medical Group — official brand lock-up. The mark and wordmark are
 * the real assets from the company's Brand Identity Guidelines, extracted
 * as image files (see /public/brand). Do not stretch, recolor, or rotate —
 * per the guidelines' "Don'ts" page.
 */
export function BrandLogo({
  size = 40,
  showWordmark = true,
  variant = "dark",
  className = "",
}: Props) {
  const { locale } = useI18n();
  const isLight = variant === "light";
  const isAr = locale === "ar";

  if (!showWordmark) {
    return <BrandMark size={size} className={className} />;
  }

  return (
    <div className={`flex items-center ${className}`} style={{ gap: Math.max(8, Math.round(size * 0.22)) }}>
      <img
        src={isLight ? "/brand/hmg-horizontal-dark.png" : "/brand/hmg-horizontal-light.png"}
        alt="Hayat Medical Group"
        style={{ height: size, width: "auto" }}
        className="object-contain"
        dir="ltr"
      />
    </div>
  );
}

type MarkProps = { size?: number; className?: string };

/** Just the square icon mark, no wordmark — for compact/collapsed contexts. */
export function BrandMark({ size = 40, className = "" }: MarkProps) {
  return (
    <img
      src="/brand/hmg-icon.png"
      alt="Hayat Medical Group"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
