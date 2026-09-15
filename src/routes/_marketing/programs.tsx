import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Computer, GraduationCap } from "lucide-react";
import { useSiteSettings, DEFAULT_SETTINGS } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_marketing/programs")({
  component: ProgramsPage,
  head: () => ({
    meta: [{ title: "Programs" }],
  }),
});

export default function ProgramsPage() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const stages = settings.programs.stages || DEFAULT_SETTINGS.programs.stages;

  const facilities = {
    ar: {
      title: "المرافق التعليمية",
      labs: "مخبر الحاسوب",
      students: "الطلاب في مخبر الحاسوب",
    },
    en: {
      title: "Educational Facilities",
      labs: "Computer Lab",
      students: "Students in the Computer Lab",
    },
    fr: {
      title: "Équipements pédagogiques",
      labs: "Laboratoire informatique",
      students: "Élèves au laboratoire informatique",
    },
  }[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold text-navy">
          {locale === "ar" ? "المراحل الدراسية" : locale === "fr" ? "Cycles et niveaux" : "Stages and Grade Levels"}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {stages.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-navy px-6 py-4">
              <h2 className="font-display text-xl font-bold text-white">{s.name[locale]}</h2>
              <span className="rounded-full bg-gold px-3 py-1 text-sm font-bold text-navy">{s.grades}</span>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-navy/80">{s.desc[locale]}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="mb-6 text-center font-display text-2xl font-bold text-navy">{facilities.title}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex h-48 items-center justify-center rounded-2xl bg-navy text-gold/70">
            <Computer className="size-12" />
          </div>
          <div className="flex h-48 items-center justify-center rounded-2xl bg-navy/80 text-gold/70">
            <GraduationCap className="size-12" />
          </div>
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/admissions"
            className="group inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3 font-bold text-navy transition-opacity hover:opacity-90"
          >
            {locale === "ar" ? "قدّم طلب التسجيل" : locale === "fr" ? "Postuler" : "Apply for Admission"}
            <ArrowLeft className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}