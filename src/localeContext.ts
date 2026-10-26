import { createContext, useContext } from "react";

export type Locale = "en" | "vi";
export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LanguageProvider");
  return context;
}
