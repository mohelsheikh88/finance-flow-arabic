import { createContext, useContext, type ReactNode } from "react";

/**
 * The official Hayat Medical Group brand identity — colors and marks taken
 * directly from the company's Brand Identity Guidelines (2026). This
 * replaces the earlier placeholder "pick your identity" system now that
 * the real brand exists; there is exactly one identity.
 */
export type BrandIdentity = {
  id: "hmg";
  nameAr: string;
  nameEn: string;
  /** Primary brand blue */
  primaryHex: string;
  /** Accent brand blue */
  accentHex: string;
  arabicFont: string;
  latinFont: string;
  swatches: string[];
};

export const HMG_IDENTITY: BrandIdentity = {
  id: "hmg",
  nameAr: "الحياة الطبية",
  nameEn: "Hayat Medical Group",
  primaryHex: "#22669A",
  accentHex: "#269BBA",
  arabicFont: "'Avenir', 'Cairo', 'Tajawal', system-ui, sans-serif",
  latinFont: "'Frutiger LT', 'Inter', system-ui, sans-serif",
  swatches: ["#22669A", "#269BBA", "#434542", "#FFFFFF"],
};

type Ctx = { identity: BrandIdentity };
const BrandIdentityContext = createContext<Ctx>({ identity: HMG_IDENTITY });

export function BrandIdentityProvider({ children }: { children: ReactNode }) {
  return (
    <BrandIdentityContext.Provider value={{ identity: HMG_IDENTITY }}>
      {children}
    </BrandIdentityContext.Provider>
  );
}

export function useBrandIdentity(): Ctx {
  return useContext(BrandIdentityContext);
}
