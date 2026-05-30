import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BrandIdentityId = "magenta" | "navy" | "copper";

export type BrandIdentity = {
  id: BrandIdentityId;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  /** Background of the mark tile */
  markBg: string;
  /** Glow / shadow color for the mark */
  markGlow: string;
  /** Stroke color for the icon glyph inside the mark */
  glyphColor: string;
  /** Wordmark color on light backgrounds */
  titleColor: string;
  /** Accent (English label) color */
  accentColor: string;
  /** Font for the Arabic wordmark */
  arabicFont: string;
  /** Font for the Latin wordmark */
  latinFont: string;
  /** Swatches shown in the settings preview */
  swatches: string[];
};

export const BRAND_IDENTITIES: Record<BrandIdentityId, BrandIdentity> = {
  magenta: {
    id: "magenta",
    nameAr: "نبض ماجنتا",
    nameEn: "Modern Magenta Ascent",
    taglineAr: "حيوي، عصري، مستوحى من النمو",
    markBg: "radial-gradient(circle at 30% 30%, #f06292 0%, #d63384 100%)",
    markGlow: "0 8px 24px -8px rgba(214, 51, 132, 0.45)",
    glyphColor: "#ffffff",
    titleColor: "#2d0d44",
    accentColor: "#d63384",
    arabicFont: "'Tajawal', 'Cairo', system-ui, sans-serif",
    latinFont: "'Inter', system-ui, sans-serif",
    swatches: ["#1a0b2e", "#2d0d44", "#d63384", "#f8d7e8"],
  },
  navy: {
    id: "navy",
    nameAr: "كحلي وذهبي",
    nameEn: "Heritage Navy & Gold",
    taglineAr: "كلاسيكي مصرفي، مستوحى من بيوت المال العالمية",
    markBg: "linear-gradient(135deg, #0e2a55 0%, #0a1b38 100%)",
    markGlow: "0 8px 24px -8px rgba(14, 42, 85, 0.5)",
    glyphColor: "#c9a24b",
    titleColor: "#0a1b38",
    accentColor: "#c9a24b",
    arabicFont: "'Amiri', 'Cairo', serif",
    latinFont: "'Playfair Display', Georgia, serif",
    swatches: ["#0a1b38", "#0e2a55", "#c9a24b", "#f4f1ea"],
  },
  copper: {
    id: "copper",
    nameAr: "فحمي ونحاسي",
    nameEn: "Charcoal & Copper",
    taglineAr: "هادئ، معماري، أنيق ومحايد",
    markBg: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
    markGlow: "0 8px 24px -8px rgba(146, 91, 62, 0.45)",
    glyphColor: "#d4a373",
    titleColor: "#1a1a1a",
    accentColor: "#925b3e",
    arabicFont: "'IBM Plex Sans Arabic', 'Cairo', sans-serif",
    latinFont: "'Inter', system-ui, sans-serif",
    swatches: ["#1a1a1a", "#925b3e", "#d4a373", "#e5d1c1"],
  },
};

const STORAGE_KEY = "brand-identity";
const DEFAULT_ID: BrandIdentityId = "magenta";

type Ctx = {
  id: BrandIdentityId;
  identity: BrandIdentity;
  setIdentity: (id: BrandIdentityId) => void;
  all: BrandIdentity[];
};

const BrandIdentityContext = createContext<Ctx | null>(null);

export function BrandIdentityProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<BrandIdentityId>(DEFAULT_ID);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as BrandIdentityId | null;
      if (stored && stored in BRAND_IDENTITIES) setId(stored);
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue in BRAND_IDENTITIES) {
        setId(e.newValue as BrandIdentityId);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setIdentity = (next: BrandIdentityId) => {
    setId(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const value: Ctx = {
    id,
    identity: BRAND_IDENTITIES[id],
    setIdentity,
    all: Object.values(BRAND_IDENTITIES),
  };

  return (
    <BrandIdentityContext.Provider value={value}>{children}</BrandIdentityContext.Provider>
  );
}

export function useBrandIdentity(): Ctx {
  const ctx = useContext(BrandIdentityContext);
  if (!ctx) {
    // Safe fallback when used outside provider (e.g. during early render)
    return {
      id: DEFAULT_ID,
      identity: BRAND_IDENTITIES[DEFAULT_ID],
      setIdentity: () => {},
      all: Object.values(BRAND_IDENTITIES),
    };
  }
  return ctx;
}
