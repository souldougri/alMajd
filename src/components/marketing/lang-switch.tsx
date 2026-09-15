import { Globe } from "lucide-react";
import type { Locale } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LOCALES: Array<{ code: Locale; label: string }> = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

export function LangSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-sm">
      <Globe className="size-4 text-gold-light" />
      <div className="flex items-center gap-1">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
              locale === l.code ? "bg-gold text-navy" : "text-white/80 hover:bg-white/15 hover:text-white",
            )}
            aria-current={locale === l.code ? "true" : undefined}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}