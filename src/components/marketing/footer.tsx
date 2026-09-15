import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { CONTACT, LINKS } from "@/lib/brand";
import { useSiteSettings } from "@/lib/site";
import { ls, useI18n } from "@/lib/i18n";

export function MarketingFooter() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();
  const g = settings.general;
  const phone1 = g.phones[0];
  const phone2 = g.phones[1];

  return (
    <footer className="bg-navy-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={g.logoUrl || "/brand/logo.jpg"} alt={g.name.ar} className="size-10 rounded-full border border-gold/40 object-cover" />
            <div className="leading-tight">
              <p className="font-bold">{g.name.ar}</p>
              <p className="text-xs text-gold-light">{g.name.en}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/70">{ls(settings.about.intro, locale)}</p>
          <p className="text-sm font-semibold text-gold">{g.motto.en}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-gold">
            {locale === "ar" ? "روابط مفيدة" : locale === "fr" ? "Liens utiles" : "Useful Links"}
          </h3>
          <ul className="space-y-2 text-sm text-white/75">
            {LINKS.nav.map((item) => (
              <li key={item.href}>
                <Link to={item.href as never} className="transition-colors hover:text-gold">
                  {ls(item.label, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-gold">
            {locale === "ar" ? "تواصل معنا" : locale === "fr" ? "Contact" : "Connect with us"}
          </h3>
          <ul className="space-y-2.5 text-sm text-white/75">
            <li>
              <a href={`mailto:${g.email}`} className="flex items-center gap-2 transition-colors hover:text-gold">
                <Mail className="size-4 text-gold" />
                {g.email}
              </a>
            </li>
            {phone1 || phone2 ? (
              <li>
                <a href={`tel:${(phone1 || phone2).replace(/\s/g, "")}`} className="flex items-center gap-2 transition-colors hover:text-gold">
                  <Phone className="size-4 text-gold" />
                  <span dir="ltr">{phone1 && phone2 ? `${phone1} / ${phone2}` : (phone1 || phone2)}</span>
                </a>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>{ls(g.address, locale)}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-gold">
            {locale === "ar" ? "فروعنا" : locale === "fr" ? "Nos succursales" : "Our branches"}
          </h3>
          <ul className="space-y-2 text-sm text-white/75">
            {CONTACT.branches.map((b) => (
              <li key={b.nameAr}>
                <span className="font-semibold text-white/90">{locale === "ar" ? b.nameAr : b.nameFr}</span>
                <span className="ml-1 text-white/60">— {b.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-white/55 sm:flex-row">
          <p>Copyright © {year} {g.name.en}</p>
          <p className="font-medium text-gold">{g.motto.en}</p>
        </div>
      </div>
    </footer>
  );
}