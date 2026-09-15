import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail, MapPin, Phone, Send } from "lucide-react";
import { CONTACT } from "@/lib/brand";
import { useSiteSettings, DEFAULT_SETTINGS } from "@/lib/site";
import { submitContactMessage } from "@/lib/contact";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_marketing/contact")({
  component: ContactPage,
  head: () => ({
    meta: [{ title: "Contact" }],
  }),
});

const inputCls =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/30";

const labelCls = "mb-1.5 block text-sm font-semibold text-navy";

export default function ContactPage() {
  const { locale } = useI18n();
  const { settings } = useSiteSettings();
  const g = settings.general;
  const phones = g.phones || [];
  const phone1 = phones[0];
  const phone2 = phones[1];
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const labels = {
    name: locale === "ar" ? "الاسم الكامل" : locale === "fr" ? "Nom complet" : "Full name",
    email: locale === "ar" ? "البريد الإلكتروني" : locale === "fr" ? "E-mail" : "Email",
    phone: locale === "ar" ? "رقم الهاتف (اختياري)" : locale === "fr" ? "Téléphone (optionnel)" : "Phone (optional)",
    subject: locale === "ar" ? "الموضوع" : locale === "fr" ? "Sujet" : "Subject",
    message: locale === "ar" ? "الرسالة" : locale === "fr" ? "Message" : "Message",
    title: locale === "ar" ? "تواصل معنا" : locale === "fr" ? "Contactez-nous" : "Contact Us",
    subtitle: locale === "ar" ? "لأي استفسار حول التسجيل أو الدراسة، يرجى التواصل معنا." : locale === "fr" ? "Pour toute question sur les admissions ou les études, contactez-nous." : "For any question about admissions or studies, please contact us.",
    submit: locale === "ar" ? "إرسال الرسالة" : locale === "fr" ? "Envoyer le message" : "Send Message",
    sent: locale === "ar" ? "تم إرسال رسالتك بنجاح. سنتواصل معك قريبًا." : locale === "fr" ? "Votre message a été envoyé. Nous vous répondrons bientôt." : "Your message has been sent successfully. We will get back to you soon.",
    missing: locale === "ar" ? "يرجى ملء الحقول المطلوبة (الاسم، البريد، الموضوع، الرسالة)." : locale === "fr" ? "Veuillez remplir les champs requis." : "Please fill in the required fields (name, email, subject, message).",
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError(labels.missing);
      return;
    }
    setError("");
    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.missing);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold text-navy">{labels.title}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-navy/60">{settings.contact.extra[locale] || DEFAULT_SETTINGS.contact.extra[locale]}</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <a href={`mailto:${g.email}`} className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-white p-5 shadow-sm transition-colors hover:border-gold">
            <div className="flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
              <Mail className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-navy/60">{locale === "ar" ? "الاتصال بالإدارة" : locale === "fr" ? "Contacter l'administration" : "Contact administration"}</p>
              <p className="truncate font-bold text-navy" dir="ltr">{g.email}</p>
            </div>
          </a>
          {phone1 || phone2 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
                <Phone className="size-5" />
              </div>
              <div>
                <p className="text-xs text-navy/60">{locale === "ar" ? "الهاتف" : locale === "fr" ? "Téléphone" : "Phone"}</p>
                <p className="font-bold text-navy" dir="ltr">{phone1 && phone2 ? `${phone1} / ${phone2}` : (phone1 || phone2)}</p>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
            <div className="flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
              <MapPin className="size-5" />
            </div>
            <div>
              <p className="text-xs text-navy/60">{locale === "ar" ? "العنوان" : locale === "fr" ? "Adresse" : "Address"}</p>
              <p className="font-bold text-navy">{g.address[locale]}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-navy text-gold">
                <MapPin className="size-5" />
              </div>
              <p className="font-bold text-navy">{locale === "ar" ? "فروعنا" : locale === "fr" ? "Nos succursales" : "Our Branches"}</p>
            </div>
            <ul className="space-y-2.5 text-sm text-navy/75">
              {CONTACT.branches.map((b) => (
                <li key={b.nameAr} className="leading-relaxed">
                  <span className="font-semibold text-navy">{locale === "ar" ? b.nameAr : b.nameFr}</span>
                  <span className="block text-xs text-navy/55">{b.desc}</span>
                </li>
              ))}
            </ul>
          </div>
          {g.mapUrl ? (
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm">
              <iframe
                src={g.mapUrl}
                title={locale === "ar" ? "موقع المجمع على الخريطة" : locale === "fr" ? "Localisation du complexe" : "Complex location"}
                className="h-56 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          {sent ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border border-gold/25 bg-white p-10 text-center shadow-sm">
              <CheckCircle2 className="size-14 text-gold" />
              <p className="font-display text-xl font-bold text-navy">{labels.sent}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-gold/20 bg-white p-8 shadow-sm">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{labels.name} *</label>
                  <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className={labelCls}>{labels.email} *</label>
                  <input className={inputCls} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className={labelCls}>{labels.phone}</label>
                  <input className={inputCls} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{labels.subject} *</label>
                  <input className={inputCls} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{labels.message} *</label>
                  <textarea
                    className={inputCls}
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>
              </div>
              {error ? <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-3 font-bold text-navy transition-opacity hover:opacity-90"
              >
                <Send className="size-4" />
                {labels.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}