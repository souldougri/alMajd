import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, Menu, Phone, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-mark";
import { LINKS } from "@/lib/brand";
import { marketingLoginHref } from "@/lib/mode";
import { useSiteSettings } from "@/lib/site";
import { ls, useI18n } from "@/lib/i18n";
import { LangSwitch } from "./lang-switch";

export function MarketingHeader() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const name = settings.general.name;
  const phones = settings.general.phones;
  const loginHref = marketingLoginHref();
  const loginLabel =
    locale === "ar"
      ? "تسجيل الدخول"
      : locale === "fr"
        ? "Connexion"
        : "Sign in";
  const loginContent = (
    <>
      <LogIn className="size-4" />
      {loginLabel}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-white shadow-lg shadow-navy/20">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src={settings.general.logoUrl || "/brand/logo.jpg"}
            alt={name.ar || settings.general.name.en}
            className="size-11 rounded-full border border-gold/40 object-cover"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-bold">{name.ar}</p>
            <p className="truncate text-xs text-gold-light">{name.en}</p>
          </div>
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          <nav className="flex items-center gap-5 text-sm">
            {LINKS.nav.map((item) => (
              <Link
                key={item.href}
                to={item.href as never}
                className="text-white/85 transition-colors hover:text-gold"
              >
                {ls(item.label, locale)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {phones.length > 0 ? (
              <a
                href={`tel:${phones[0].replace(/\s/g, "")}`}
                className="hidden items-center gap-1.5 text-xs text-white/80 xl:flex"
              >
                <Phone className="size-3.5 text-gold" />
                {phones[0]}
              </a>
            ) : null}
            <LangSwitch />
            <button
              type="button"
              onClick={() => window.location.assign(loginHref)}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition-opacity hover:opacity-90"
            >
              {loginContent}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.assign(loginHref)}
          className="hidden min-h-11 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition-opacity hover:opacity-90 sm:flex lg:hidden"
        >
          {loginContent}
        </button>

        <button
          type="button"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-white/85 hover:bg-white/10 lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="القائمة"
          aria-expanded={open}
          aria-controls="site-drawer"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] bg-navy/45 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="site-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        className={`fixed inset-y-0 right-0 z-[70] flex w-72 max-w-[85vw] flex-col bg-navy text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={settings.general.logoUrl || "/brand/logo.jpg"}
              alt={name.ar || settings.general.name.en}
              className="size-10 rounded-full border border-gold/40 object-cover"
            />
            <p className="truncate font-display text-lg font-bold">{name.ar}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-white/85 hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 gap-2 overflow-y-auto p-3">
          {LINKS.nav.map((item) => (
            <Link
              key={item.href}
              to={item.href as never}
              className="flex min-h-11 items-center rounded-md px-3 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-gold"
              onClick={() => setOpen(false)}
            >
              {ls(item.label, locale)}
            </Link>
          ))}
        </nav>
        <div className="shrink-0 space-y-3 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.location.assign(loginHref);
            }}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy"
          >
            {loginContent}
          </button>
          <div className="flex justify-center">
            <LangSwitch />
          </div>
        </div>
      </aside>
    </header>
  );
}
