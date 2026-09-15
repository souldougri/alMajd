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
  const loginInternal = loginHref === "/login";
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
            {loginInternal ? (
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition-opacity hover:opacity-90"
              >
                {loginContent}
              </Link>
            ) : (
              <a
                href={loginHref}
                className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition-opacity hover:opacity-90"
              >
                {loginContent}
              </a>
            )}
          </div>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-white/85 hover:bg-white/10 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="القائمة"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-navy px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2">
            {LINKS.nav.map((item) => (
              <Link
                key={item.href}
                to={item.href as never}
                className="rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-gold"
                onClick={() => setOpen(false)}
              >
                {ls(item.label, locale)}
              </Link>
            ))}
            {loginInternal ? (
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy"
                onClick={() => setOpen(false)}
              >
                {loginContent}
              </Link>
            ) : (
              <a
                href={loginHref}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy"
                onClick={() => setOpen(false)}
              >
                {loginContent}
              </a>
            )}
            <div className="mt-2 flex justify-center">
              <LangSwitch />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
