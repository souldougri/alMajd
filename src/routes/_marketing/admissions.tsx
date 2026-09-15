import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, MonitorPlay, Phone, Send, UserPlus } from "lucide-react";
import { useSiteSettings, DEFAULT_SETTINGS } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_marketing/admissions")({
  component: AdmissionsPage,
  head: () => ({
    meta: [{ title: "Admissions" }],
  }),
});

const stepsAr = [
  "تواصل مع إدارة المجمع أو أحد فروعنا لاستلام ملف التسجيل.",
  "قدّم الوثائق المطلوبة: شهادة الميلاد، شهادة المستوى السابق، صور شخصية.",
  "أكمل تسجيل بيانات الطالب وسدد رسوم التسجيل.",
];

const stepsFr = [
  "Contactez l'administration du complexe ou l'une de nos succursales pour obtenir le dossier d'inscription.",
  "Fournissez les documents requis : acte de naissance, certificat du niveau précédent, photos.",
  "Complétez l'enregistrement et payez les frais d'inscription.",
];

const stepsEn = [
  "Contact the complex administration or one of our branches to receive the enrollment file.",
  "Submit the required documents: birth certificate, previous level certificate, passport photos.",
  "Complete the student registration and pay the enrollment fees.",
];

export default function AdmissionsPage() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const g = settings.general;
  const phones = g.phones || [];
  const phone1 = phones[0];
  const phone2 = phones[1];
  const steps = locale === "ar" ? stepsAr : locale === "fr" ? stepsFr : stepsEn;
  const admissionsText = settings.admissions.text[locale] || DEFAULT_SETTINGS.admissions.text[locale];

  const titles = {
    ar: { main: "التسجيل والقبول", online: "قبول الطلاب في الخارج — تعليم عن بُعد", inPerson: "التسجيل الحضوري في تشاد", info: "معلومات التواصل" },
    en: { main: "Admissions", online: "International Students — Remote Learning", inPerson: "In-Person Enrollment in Chad", info: "Contact Information" },
    fr: { main: "Admissions", online: "Élèves à l'étranger — Enseignement à distance", inPerson: "Inscription en présentiel au Tchad", info: "Informations de contact" },
  }[locale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold text-navy">{titles.main}</h1>
        <p className="mt-2 font-semibold tracking-[0.2em] text-gold">{g.motto.en}</p>
      </div>

      <div className="mx-auto mb-12 max-w-3xl text-center">
        <p className="text-lg leading-relaxed text-navy/80">{admissionsText}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
            <UserPlus className="size-6" />
          </div>
          <h2 className="font-bold text-navy">{locale === "ar" ? "التسجيل الحضوري" : locale === "fr" ? "Inscription en présentiel" : "In-Person Enrollment"}</h2>
          <p className="mt-2 text-sm text-navy/70">
            {locale === "ar"
              ? "يرجى التواصل مع إدارة المجمع للحصول على ملف التسجيل وبدء إجراءات قبول الطالب."
              : locale === "fr"
                ? "Veuillez contacter l'administration pour recevoir le dossier d'inscription et entamer la procédure."
                : "Please contact the administration to receive the enrollment file and start the admission process."}
          </p>
        </div>

        <div className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
            <MonitorPlay className="size-6" />
          </div>
          <h2 className="font-bold text-navy">{locale === "ar" ? "التعليم عن بُعد" : locale === "fr" ? "Enseignement à distance" : "Remote Learning"}</h2>
          <p className="mt-2 text-sm text-navy/70">
            {locale === "ar"
              ? "التسجيل عن بُعد مفتوح لطلابنا خارج تشاد بنفس المنهج ومتابعة كاملة."
              : locale === "fr"
                ? "L'inscription à distance est ouverte à nos élèves hors du Tchad avec le même programme et un suivi complet."
                : "Remote enrollment is open to our students outside Chad with the same curriculum and full tracking."}
          </p>
        </div>

        <div className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
            <FileText className="size-6" />
          </div>
          <h2 className="font-bold text-navy">{locale === "ar" ? "الوثائق المطلوبة" : locale === "fr" ? "Documents requis" : "Required Documents"}</h2>
          <ul className="mt-2 space-y-1 text-sm text-navy/70">
            {["شهادة ميلاد", "شهادة المستوى السابق", "صور شخصية"].map((d) => (
              <li key={d} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-gold" /> {d}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gold/15">
          <h3 className="mb-4 font-display text-lg font-bold text-navy">{titles.info}</h3>
          <ul className="space-y-3 text-sm text-navy/80">
            <li>
              <a href={`mailto:${g.email}`} className="flex items-center gap-2 hover:text-gold">
                <Phone className="size-4 text-gold" /> {g.email}
              </a>
            </li>
            {phone1 || phone2 ? (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-gold" />
                <span dir="ltr">{phone1 && phone2 ? `${phone1} / ${phone2}` : (phone1 || phone2)}</span>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl bg-navy p-6 text-white shadow-sm">
          <h3 className="mb-3 font-display text-lg font-bold text-gold">{titles.online}</h3>
          <p className="text-sm leading-relaxed text-white/80">
            {locale === "ar"
              ? "الطلاب المتواجدون في الخليج يمكنهم التواصل مباشرة مع إدارة الفرع عن بُعد."
              : locale === "fr"
                ? "Les élèves du Golfe peuvent contacter directement la succursale à distance."
                : "Students in the Gulf can contact the remote branch administration directly."}
          </p>
        </div>
      </div>

      <section className="mx-auto mt-16 max-w-3xl rounded-3xl border border-gold/20 bg-white p-8 shadow-sm">
        <h2 className="mb-8 flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <Send className="size-5 text-gold" />
          {locale === "ar" ? "خطوات التسجيل" : locale === "fr" ? "Étapes d'inscription" : "Enrollment Steps"}
        </h2>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-navy">{i + 1}</span>
              <p className="pt-1 text-sm leading-relaxed text-navy/80">{s}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}