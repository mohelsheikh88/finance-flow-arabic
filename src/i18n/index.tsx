import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Locale } from "./translations";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
};


const I18nContext = createContext<Ctx | null>(null);

function resolve(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return path;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    try {
      const stored = (typeof window !== "undefined" && window.localStorage.getItem("locale")) as
        | Locale
        | null;
      if (stored === "ar" || stored === "en") setLocaleState(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem("locale", l);
    } catch {}
  };

  const t = (path: string, vars?: Record<string, string | number>) => {
    let s = resolve(translations[locale], path);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Pick the right localized field from a record */
export function useLocalized() {
  const { locale } = useI18n();
  return <T extends Record<string, unknown>>(row: T, base: string): string => {
    const key = locale === "ar" ? `${base}_ar` : `${base}_en`;
    const v = row[key] ?? row[`${base}_en`] ?? row[`${base}_ar`] ?? "";
    return String(v ?? "");
  };
}
