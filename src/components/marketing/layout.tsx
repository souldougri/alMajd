import { Outlet } from "@tanstack/react-router";
import { I18nProvider } from "@/lib/i18n";
import { SiteSettingsProvider } from "@/lib/site-context";
import { MarketingHeader } from "./header";
import { MarketingFooter } from "./footer";

export function MarketingLayout() {
  return (
    <I18nProvider>
      <SiteSettingsProvider>
        <div className="flex min-h-dvh flex-col bg-cream text-navy" dir="auto">
          <MarketingHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <MarketingFooter />
        </div>
      </SiteSettingsProvider>
    </I18nProvider>
  );
}