import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  Computer,
  GraduationCap,
  MonitorPlay,
  Newspaper,
  Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PortalLanding } from "@/components/portal/landing";
import { isPortalMode } from "@/lib/mode";
import { useSiteSettings, DEFAULT_SETTINGS } from "@/lib/site";
import { ls, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fetchPublicNews, type NewsItem } from "@/lib/news";
import { formatPrintDate } from "@/lib/print";

export const Route = createFileRoute("/_marketing/")({
  component: HomeRoute,
  head: () => ({
    meta: [
      {
        title: isPortalMode()
          ? "مجمع المجد التعليمي العربي — بوابة الدخول"
          : "Madjd Educational Complex",
      },
    ],
  }),
});

function HomeRoute() {
  if (isPortalMode()) return <PortalLanding />;
  return <HomePage />;
}

const ACHIEVEMENT_ICONS = [Award, BookOpenCheck, Computer];

export default function HomePage() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const g = settings.general;
  const home = settings.home;
  const hero = {
    title: home.heroTitle[locale] || g.name[locale],
    subtitle: home.heroSubtitle[locale],
    cta: home.heroCta[locale],
    motto: g.motto[locale],
  };
  const phones = g.phones || [];
  const stages = settings.programs.stages || [];

  const life = [
    {
      ar: "حصّة لغة عربية",
      en: "An Arabic language class",
      fr: "Un cours de langue arabe",
    },
    {
      ar: "اصطفاف الصباح للمرحلة الابتدائية",
      en: "Primary stage morning assembly",
      fr: "Rassemblement matinal du primaire",
    },
    {
      ar: "طلاب المرحلة الثانوية",
      en: "Secondary stage students",
      fr: "Élèves du secondaire",
    },
    {
      ar: "طلابنا يمثلون المجمع في المناسبات الرسمية",
      en: "Our students representing the complex at official events",
      fr: "Nos élèves représentent le complexe lors des événements officiels",
    },
    {
      ar: "حملة توعوية حول أهمية القراءة",
      en: "Awareness campaign on the importance of reading",
      fr: "Campagne de sensibilisation sur l'importance de la lecture",
    },
    {
      ar: "القراءة عادة يومية لطلابنا",
      en: "Reading is a daily habit for our students",
      fr: "La lecture est une habitude quotidienne de nos élèves",
    },
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-navy text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60rem 30rem at 80% -10%, rgba(216,154,62,0.35), transparent 60%), radial-gradient(50rem 28rem at 10% 110%, rgba(216,154,62,0.2), transparent 55%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center lg:flex-row lg:py-28 lg:text-start">
          <div className="flex-1">
            <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-gold-light">
              {hero.motto}
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              {hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                to="/admissions"
                className="group flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-bold text-navy transition-opacity hover:opacity-90"
              >
                {hero.cta}
                <ArrowLeft
                  className={cn(
                    "size-4 transition-transform group-hover:-translate-x-0.5",
                    locale === "ar" ? "" : "rotate-180",
                  )}
                />
              </Link>
              {phones.length > 0 ? (
                <a
                  href={`tel:${phones[0].replace(/\s/g, "")}`}
                  className="flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:border-gold hover:text-gold"
                >
                  <Phone className="size-4" />
                  {phones[0]}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex w-full max-w-sm shrink-0 justify-center">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-gold/30">
              <img
                src={g.logoUrl || "/brand/logo.jpg"}
                alt={g.name.ar}
                className="size-56 rounded-xl object-cover sm:size-64"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
        {home.achievements.length > 0
          ? home.achievements.map((a, i) => {
              const Icon = ACHIEVEMENT_ICONS[i % ACHIEVEMENT_ICONS.length];
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
                    <Icon className="size-6" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    {a.title[locale]}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy/70">
                    {a.sub[locale]}
                  </p>
                </div>
              );
            })
          : // Fallback to default achievements if CMS is empty
            DEFAULT_SETTINGS.home.achievements.map((a, i) => {
              const Icon = ACHIEVEMENT_ICONS[i % ACHIEVEMENT_ICONS.length];
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
                    <Icon className="size-6" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    {a.title[locale]}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy/70">
                    {a.sub[locale]}
                  </p>
                </div>
              );
            })}
      </section>

      <LatestNews />

      <section className="bg-navy/5">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-bold text-navy">
              {locale === "ar"
                ? "مراحلنا التعليمية"
                : locale === "fr"
                  ? "Nos cycles"
                  : "Our Educational Stages"}
            </h2>
            <p className="mt-2 text-navy/60">
              {locale === "ar"
                ? "من الابتدائي حتى الثانوي"
                : locale === "fr"
                  ? "Du primaire au secondaire"
                  : "From primary through secondary"}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {stages.length > 0
              ? stages.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-navy/5"
                  >
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gold/15 text-2xl">
                      {s.icon}
                    </div>
                    <h3 className="font-display text-xl font-bold text-navy">
                      {s.name[locale]}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-gold">
                      {s.grades}
                    </p>
                  </div>
                ))
              : // Fallback to default stages if CMS is empty
                DEFAULT_SETTINGS.programs.stages.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-navy/5"
                  >
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gold/15 text-2xl">
                      {s.icon}
                    </div>
                    <h3 className="font-display text-xl font-bold text-navy">
                      {s.name[locale]}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-gold">
                      {s.grades}
                    </p>
                  </div>
                ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/programs"
              className="text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 hover:text-gold"
            >
              {locale === "ar"
                ? "عرض كافة المراحل"
                : locale === "fr"
                  ? "Voir tous les cycles"
                  : "See all grade levels"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold text-navy">
            {locale === "ar"
              ? "لمحات من حياتنا المدرسية"
              : locale === "fr"
                ? "Aperçu de la vie scolaire"
                : "Glimpses of Our School Life"}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {life.map((item) => (
            <figure
              key={item.ar}
              className="overflow-hidden rounded-2xl border border-gold/15 bg-white shadow-sm"
            >
              <div className="flex h-32 items-center justify-center bg-navy text-gold/70 sm:h-40">
                <GraduationCap className="size-10" />
              </div>
              <figcaption className="p-3 text-center text-sm font-medium text-navy">
                {ls(item, locale)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gold text-navy">
            <MonitorPlay className="size-7" />
          </div>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold">
              {locale === "ar"
                ? "التعليم عن بُعد"
                : locale === "fr"
                  ? "Enseignement à distance"
                  : "Remote Learning"}
            </h2>
            <p className="mt-3 leading-relaxed text-white/80">
              {home.remote[locale]}
            </p>
          </div>
          <Link
            to="/admissions"
            className="rounded-full bg-gold px-6 py-3 font-bold text-navy transition-opacity hover:opacity-90"
          >
            {hero.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}

function LatestNews() {
  const { locale } = useI18n();
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicNews()
      .then((list) => {
        if (!cancelled) setItems(list.slice(0, 3));
      })
      .catch(() => {
        /* silent — teaser is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  const titleOf = (item: NewsItem) =>
    locale === "fr" && item.titleFr
      ? item.titleFr
      : locale === "en" && item.titleEn
        ? item.titleEn
        : item.titleAr;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-navy">
          {locale === "ar"
            ? "أحدث الأخبار"
            : locale === "fr"
              ? "Dernières actualités"
              : "Latest News"}
        </h2>
        <Link
          to="/news"
          className="flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-gold decoration-2 underline-offset-4 hover:text-gold"
        >
          <Newspaper className="size-4" />
          {locale === "ar"
            ? "كل الأخبار"
            : locale === "fr"
              ? "Toutes les actualités"
              : "All news"}
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="group overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {item.cover ? (
              <img
                src={item.cover}
                alt={item.titleAr}
                className="h-36 w-full object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center bg-navy text-gold/70">
                <Newspaper className="size-9" />
              </div>
            )}
            <div className="p-5">
              <time className="text-xs font-semibold text-gold">
                {formatPrintDate(item.date)}
              </time>
              <h3 className="mt-1.5 line-clamp-2 font-bold text-navy">
                {titleOf(item)}
              </h3>
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-navy/65">
                {item.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
