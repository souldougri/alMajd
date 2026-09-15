import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "./brand";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "rtl" | "ltr";
};

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_KEY = "almajd-locale";

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (raw === "en" || raw === "fr") return raw;
  } catch {
    /* noop */
  }
  return "ar";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "ar";
    return readStoredLocale();
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, dir: locale === "ar" ? "rtl" : "ltr" }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

type LocaleStrings = Record<Locale, string>;

export function pick(locale: Locale, s: LocaleStrings): string {
  return s[locale];
}

export function ls(s: { ar: string; en: string; fr: string }, locale: Locale): string {
  return s[locale];
}