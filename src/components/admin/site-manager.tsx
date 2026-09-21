import { useEffect, useState, type ReactNode } from "react";
import { Check, Home, Info, LayoutTemplate, Loader2, Mail, Newspaper, Plus, School, Trash2, Users } from "lucide-react";
import { Upload as UploadIcon } from "lucide-react";
import { NewsManager } from "./news-manager";
import {
  DEFAULT_SETTINGS,
  fetchRawSettings,
  resolveSettings,
  saveSettings,
  uploadSiteImage,
  type LocaleText,
  type SiteSettings,
} from "@/lib/site";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "general", label: "البيانات العامة", icon: School },
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "about", label: "من نحن", icon: Info },
  { id: "programs", label: "المراحل", icon: LayoutTemplate },
  { id: "admissions", label: "التسجيل", icon: Users },
  { id: "contact", label: "تواصل", icon: Mail },
  { id: "news", label: "الأخبار", icon: Newspaper },
] as const;

type TabId = (typeof TABS)[number]["id"];

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const AREA_CLS =
  "w-full rounded-xl border border-navy/15 bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

const LOCALE_META = [
  { key: "ar" as const, label: "العربية" },
  { key: "en" as const, label: "English" },
  { key: "fr" as const, label: "Français" },
];

function cloneSettings(s: SiteSettings): SiteSettings {
  return JSON.parse(JSON.stringify(s)) as SiteSettings;
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="am-card p-5 shadow-sm">
      <h2 className="font-bold text-navy">{title}</h2>
      {desc ? <p className="mt-0.5 text-xs text-navy/50">{desc}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function LocaleInput({ value, onChange }: { value: LocaleText; onChange: (v: LocaleText) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {LOCALE_META.map((m) => (
        <div key={m.key}>
          <span className="mb-1 block text-[11px] font-semibold text-navy/45">{m.label}</span>
          <input
            className={INPUT_CLS}
            dir="auto"
            value={value[m.key]}
            onChange={(e) => onChange({ ...value, [m.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function LocaleArea({ value, onChange, rows = 4 }: { value: LocaleText; onChange: (v: LocaleText) => void; rows?: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {LOCALE_META.map((m) => (
        <div key={m.key}>
          <span className="mb-1 block text-[11px] font-semibold text-navy/45">{m.label}</span>
          <textarea
            className={AREA_CLS}
            dir="auto"
            rows={rows}
            value={value[m.key]}
            onChange={(e) => onChange({ ...value, [m.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-navy/60">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-navy/40">{hint}</span> : null}
    </label>
  );
}

export function SiteManager() {
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRawSettings()
      .then((raw) => {
        if (cancelled) return;
        setDraft(resolveSettings(raw));
      })
      .catch(() => {
        if (!cancelled) setDraft(cloneSettings(DEFAULT_SETTINGS));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(mutator: (d: SiteSettings) => void) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = cloneSettings(prev);
      mutator(next);
      return next;
    });
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await saveSettings(draft);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
  }

  async function uploadLogo(file: File) {
    const res = await uploadSiteImage(file);
    if (res.error) {
      setError(res.error);
    } else if (res.url) {
      patch((d) => {
        d.general.logoUrl = res.url as string;
      });
    }
  }

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center py-20 text-navy/50">
        <Loader2 className="size-5 animate-spin" />
        <span className="ms-2 text-sm">جارٍ تحميل إعدادات الموقع...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">الموقع العام</h1>
          <p className="mt-1 text-sm text-navy/60">
            كل النصوص هنا تظهر مباشرة في صفحات الموقع العامة دون الحاجة لأي تعديل برمجي. إذا تُركت حقل فارغ، يظهر النص الحالي تلقائيًا.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-11 items-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-gold transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {saving ? "جارٍ الحفظ..." : "حفظ جميع التغييرات"}
        </button>
      </div>

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}
      {saved ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">تم حفظ الإعدادات بنجاح.</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              tab === t.id ? "bg-navy text-gold" : "bg-white text-navy/60 hover:text-navy",
            )}
          >
            <t.icon className="size-4" strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="space-y-4">
          <Section title="اسم المؤسسة" desc="يظهر في الترويسة والنسق العام للموقع.">
            <LocaleInput value={draft.general.name} onChange={(v) => patch((d) => { d.general.name = v; })} />
          </Section>

          <Section title="الشعار (Motto)">
            <LocaleInput value={draft.general.motto} onChange={(v) => patch((d) => { d.general.motto = v; })} />
          </Section>

          <Section title="شعار المؤسسة (الصورة)" desc="صيغ مدعومة: JPG, PNG, WebP — بحد أقصى 10MB.">
            <div className="flex items-center gap-4">
              <img
                src={draft.general.logoUrl || "/brand/logo.jpg"}
                alt="logo"
                className="size-20 rounded-full border border-gold/40 object-cover"
              />
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-gold transition-opacity hover:opacity-90">
                <UploadIcon className="size-4" />
                رفع صورة الشعار
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </Section>

          <Section title="التواصل">
            <Field label="البريد الإلكتروني">
              <input className={INPUT_CLS} dir="ltr" value={draft.general.email} onChange={(e) => patch((d) => { d.general.email = e.target.value; })} />
            </Field>
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-navy/60">أرقام الهاتف</span>
              {draft.general.phones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={INPUT_CLS}
                    dir="ltr"
                    value={p}
                    onChange={(e) =>
                      patch((d) => {
                        d.general.phones[i] = e.target.value;
                      })
                    }
                  />
                  {draft.general.phones.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patch((d) => { d.general.phones = d.general.phones.filter((_, j) => j !== i); })}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-danger/30 text-danger hover:bg-danger/10"
                      aria-label="حذف الرقم"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch((d) => { d.general.phones = [...d.general.phones, ""]; })}
                className="flex items-center gap-1.5 text-sm font-bold text-navy hover:text-gold"
              >
                <Plus className="size-4" /> إضافة رقم هاتف
              </button>
            </div>
          </Section>

          <Section title="العنوان والخريطة">
            <Field label="العنوان">
              <LocaleArea rows={2} value={draft.general.address} onChange={(v) => patch((d) => { d.general.address = v; })} />
            </Field>
            <Field label="رابط الخريطة (اختياري)" hint="الصق رابط إطار Google Maps (src) ليظهر في صفحة الاتصال.">
              <input className={INPUT_CLS} dir="ltr" value={draft.general.mapUrl} onChange={(e) => patch((d) => { d.general.mapUrl = e.target.value; })} />
            </Field>
          </Section>
        </div>
      ) : null}

      {tab === "home" ? (
        <div className="space-y-4">
          <Section title="الواجهة (Hero)">
            <Field label="العنوان الرئيسي">
              <LocaleInput value={draft.home.heroTitle} onChange={(v) => patch((d) => { d.home.heroTitle = v; })} />
            </Field>
            <Field label="النص التعريفي">
              <LocaleArea rows={3} value={draft.home.heroSubtitle} onChange={(v) => patch((d) => { d.home.heroSubtitle = v; })} />
            </Field>
            <Field label="نص زر التسجيل">
              <LocaleInput value={draft.home.heroCta} onChange={(v) => patch((d) => { d.home.heroCta = v; })} />
            </Field>
          </Section>

          <Section title="إنجازات البطاقات">
            {draft.home.achievements.map((a, i) => (
              <div key={a.id} className="rounded-xl border border-navy/10 bg-cream/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-navy/55">بطاقة {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => patch((d) => { d.home.achievements = d.home.achievements.filter((x) => x.id !== a.id); })}
                    className="flex size-8 items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10"
                    aria-label="حذف البطاقة"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <Field label="العنوان">
                    <LocaleInput value={a.title} onChange={(v) => patch((d) => { d.home.achievements[i].title = v; })} />
                  </Field>
                  <Field label="الوصف">
                    <LocaleArea rows={2} value={a.sub} onChange={(v) => patch((d) => { d.home.achievements[i].sub = v; })} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch((d) => {
                  d.home.achievements = [
                    ...d.home.achievements,
                    {
                      id: `achievement-${Date.now().toString(36)}`,
                      title: { ar: "", en: "", fr: "" },
                      sub: { ar: "", en: "", fr: "" },
                    },
                  ];
                })
              }
              className="flex items-center gap-1.5 text-sm font-bold text-navy hover:text-gold"
            >
              <Plus className="size-4" /> إضافة بطاقة إنجاز
            </button>
          </Section>

          <Section title="التعليم عن بُعد">
            <LocaleArea rows={3} value={draft.home.remote} onChange={(v) => patch((d) => { d.home.remote = v; })} />
          </Section>
        </div>
      ) : null}

      {tab === "about" ? (
        <div className="space-y-4">
          <Section title="نبذة عن المؤسسة">
            <LocaleArea rows={5} value={draft.about.intro} onChange={(v) => patch((d) => { d.about.intro = v; })} />
          </Section>
          <Section title="الرؤية">
            <LocaleArea rows={3} value={draft.about.vision} onChange={(v) => patch((d) => { d.about.vision = v; })} />
          </Section>
          <Section title="الرسالة">
            <LocaleArea rows={3} value={draft.about.mission} onChange={(v) => patch((d) => { d.about.mission = v; })} />
          </Section>
        </div>
      ) : null}

      {tab === "programs" ? (
        <div className="space-y-4">
          <Section title="المراحل الدراسية">
            {draft.programs.stages.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-navy/10 bg-cream/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-navy/55">مرحلة {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => patch((d) => { d.programs.stages = d.programs.stages.filter((x) => x.id !== s.id); })}
                    className="flex size-8 items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10"
                    aria-label="حذف المرحلة"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <Field label="اسم المرحلة">
                    <LocaleInput value={s.name} onChange={(v) => patch((d) => { d.programs.stages[i].name = v; })} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="نطاق الصفوف">
                      <input className={INPUT_CLS} value={s.grades} onChange={(e) => patch((d) => { d.programs.stages[i].grades = e.target.value; })} />
                    </Field>
                    <Field label="أيقونة (رمز تعبيري)">
                      <input className={INPUT_CLS} value={s.icon} onChange={(e) => patch((d) => { d.programs.stages[i].icon = e.target.value; })} />
                    </Field>
                  </div>
                  <Field label="الوصف">
                    <LocaleArea rows={2} value={s.desc} onChange={(v) => patch((d) => { d.programs.stages[i].desc = v; })} />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch((d) => {
                  d.programs.stages = [
                    ...d.programs.stages,
                    { id: `stage-${Date.now().toString(36)}`, name: { ar: "", en: "", fr: "" }, grades: "", desc: { ar: "", en: "", fr: "" }, icon: "🎓" },
                  ];
                })
              }
              className="flex items-center gap-1.5 text-sm font-bold text-navy hover:text-gold"
            >
              <Plus className="size-4" /> إضافة مرحلة
            </button>
          </Section>
        </div>
      ) : null}

      {tab === "admissions" ? (
        <Section title="نص صفحة التسجيل">
          <LocaleArea rows={5} value={draft.admissions.text} onChange={(v) => patch((d) => { d.admissions.text = v; })} />
        </Section>
      ) : null}

      {tab === "contact" ? (
        <Section title="نص صفحة التواصل" desc="يليها العنوان وأرقام الهاتف والبريد من خانة البيانات العامة تلقائيًا.">
          <LocaleArea rows={4} value={draft.contact.extra} onChange={(v) => patch((d) => { d.contact.extra = v; })} />
        </Section>
      ) : null}

      {tab === "news" ? <NewsManager /> : null}
    </div>
  );
}