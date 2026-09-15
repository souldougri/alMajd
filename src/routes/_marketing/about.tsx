import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BookOpenCheck, Computer, Eye, MapPin, Target } from "lucide-react";
import { CONTACT } from "@/lib/brand";
import { useSiteSettings, DEFAULT_SETTINGS } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_marketing/about")({
  component: AboutPage,
  head: () => ({
    meta: [{ title: "About Us" }],
  }),
});

export default function AboutPage() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const g = settings.general;

  const copy = {
    ar: {
      title: "من نحن",
      vision: "رؤيتنا",
      mission: "رسالتنا",
      branches: "فروعنا",
      achievements: "إنجازاتنا ومشاركاتنا",
    },
    en: {
      title: "About Us",
      vision: "Our Vision",
      mission: "Our Mission",
      branches: "Our Branches",
      achievements: "Our Achievements and Participation",
    },
    fr: {
      title: "À propos",
      vision: "Notre vision",
      mission: "Notre mission",
      branches: "Nos succursales",
      achievements: "Nos réalisations et participations",
    },
  }[locale];

  const achievements = [
    { icon: Award, ar: "من ضمن أوائل الناجحين في البكالوريا بتشاد 2022", en: "Among Chad's Top 2022 Baccalaureate Graduates", fr: "Parmi les meilleurs lauréats du Baccalauréat tchadien 2022" },
    { icon: BookOpenCheck, ar: "شهادة تقدير من الاتحاد العام لدعم اللغة العربية", en: "Certificate from the Arabic Language Support Union", fr: "Certificat de l'Union de soutien à la langue arabe" },
    { icon: Computer, ar: "مخبر حاسوب متكامل التجهيز", en: "A Fully Equipped Computer Lab", fr: "Laboratoire informatique entièrement équipé" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold text-navy">{copy.title}</h1>
        <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-gold">{g.name.en}</p>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-lg leading-relaxed text-navy/80">{settings.about.intro[locale] || DEFAULT_SETTINGS.about.intro[locale]}</p>
        <p className="mt-4 font-display text-2xl font-bold text-gold">{g.motto[locale]}</p>
      </div>

      <section className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/20 bg-white p-7 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
            <Eye className="size-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-navy">{copy.vision}</h2>
          <p className="mt-2 leading-relaxed text-navy/75">{settings.about.vision[locale] || DEFAULT_SETTINGS.about.vision[locale]}</p>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-white p-7 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
            <Target className="size-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-navy">{copy.mission}</h2>
          <p className="mt-2 leading-relaxed text-navy/75">{settings.about.mission[locale] || DEFAULT_SETTINGS.about.mission[locale]}</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-6 text-center font-display text-2xl font-bold text-navy">{copy.branches}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTACT.branches.map((b) => (
            <div key={b.nameAr} className="flex items-start gap-3 rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-gold">
                <MapPin className="size-5" />
              </div>
              <div>
                <p className="font-bold text-navy">{locale === "ar" ? b.nameAr : b.nameFr}</p>
                <p className="mt-1 text-sm text-navy/70">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-6 text-center font-display text-2xl font-bold text-navy">{copy.achievements}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {achievements.map((a) => (
            <div key={a.ar} className="rounded-2xl border border-gold/20 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
                <a.icon className="size-6" />
              </div>
              <h3 className="font-bold text-navy">{locale === "ar" ? a.ar : locale === "fr" ? a.fr : a.en}</h3>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 flex justify-center">
        <Link
          to="/admissions"
          className="rounded-full bg-navy px-8 py-3 font-bold text-white transition-colors hover:bg-navy-dark"
        >
          {locale === "ar" ? "قدم طلب التسجيل" : locale === "fr" ? "Postuler" : "Apply for Admission"}
        </Link>
      </div>
    </div>
  );
}