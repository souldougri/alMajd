import { createContext, useContext } from "react";
import { api } from "./api";
import { MOTTO, STAGES } from "./brand";
import { SCHOOL } from "./school";

export type LocaleText = { ar: string; en: string; fr: string };

export type Achievement = {
  id: string;
  title: LocaleText;
  sub: LocaleText;
};

export type Stage = {
  id: string;
  name: LocaleText;
  grades: string;
  desc: LocaleText;
  icon: string;
};

export type SiteSettings = {
  general: {
    name: LocaleText;
    motto: LocaleText;
    logoUrl: string;
    phones: string[];
    email: string;
    address: LocaleText;
    mapUrl: string;
  };
  home: {
    heroTitle: LocaleText;
    heroSubtitle: LocaleText;
    heroCta: LocaleText;
    achievements: Achievement[];
    remote: LocaleText;
  };
  about: {
    intro: LocaleText;
    vision: LocaleText;
    mission: LocaleText;
  };
  programs: {
    stages: Stage[];
  };
  admissions: {
    text: LocaleText;
  };
  contact: {
    extra: LocaleText;
  };
};

/** Current hardcoded marketing copy — used as a safe fallback so the site never goes blank. */
export const DEFAULT_SETTINGS: SiteSettings = {
  general: {
    name: { ar: SCHOOL.nameAr, en: SCHOOL.nameEn, fr: SCHOOL.nameFr },
    motto: { ar: MOTTO.ar, en: MOTTO.en, fr: MOTTO.fr },
    logoUrl: SCHOOL.logo,
    phones: [...SCHOOL.phones],
    email: SCHOOL.email,
    address: {
      ar: "الشايوط، نجامينا، جمهورية تشاد",
      en: "Chawir, N'Djamena, Republic of Chad",
      fr: "Chawir, N'Djaména, République du Tchad",
    },
    mapUrl: "",
  },
  home: {
    heroTitle: { ar: SCHOOL.nameAr, en: SCHOOL.nameEn, fr: SCHOOL.nameFr },
    heroSubtitle: {
      ar: "تعليم متكامل من الابتدائي حتى الثانوي، حضوريًا في تشاد أو عن بُعد لطلابنا في الخارج.",
      en: "Complete education from primary through secondary, in-person in Chad or remotely for our students abroad.",
      fr: "Éducation complète du primaire au secondaire, en présentiel au Tchad ou à distance pour nos élèves à l'étranger.",
    },
    heroCta: { ar: "قدّم طلب التسجيل", en: "Apply Now", fr: "Postuler" },
    achievements: [
      {
        id: "achievement-1",
        title: {
          ar: "من ضمن أوائل الناجحين في البكالوريا بتشاد 2022",
          en: "Among Chad's Top 2022 Baccalaureate Graduates",
          fr: "Parmi les meilleurs lauréats du Baccalauréat tchadien 2022",
        },
        sub: {
          ar: "تكريم عدة طلاب في الحفل الوطني للعام الدراسي 2022.",
          en: "Several of our students were honored at Chad's national ceremony recognizing the country's top Baccalaureate graduates of 2022.",
          fr: "Plusieurs de nos élèves ont été honorés lors de la cérémonie nationale tchadienne de 2022.",
        },
      },
      {
        id: "achievement-2",
        title: {
          ar: "شهادة تقدير من الاتحاد العام لدعم اللغة العربية",
          en: "Certificate from the Arabic Language Support Union",
          fr: "Certificat de l'Union générale de soutien à la langue arabe",
        },
        sub: {
          ar: "حصل المجمع على شهادة تقدير من الاتحاد العام للمؤسسات الداعمة للغة العربية في تشاد.",
          en: "The complex received a certificate of appreciation from the General Union of Institutions Supporting the Arabic Language in Chad.",
          fr: "Le complexe a reçu un certificat d'appréciation de l'Union générale des institutions soutenant la langue arabe au Tchad.",
        },
      },
      {
        id: "achievement-3",
        title: {
          ar: "مخبر حاسوب متكامل التجهيز",
          en: "A Fully Equipped Computer Lab",
          fr: "Laboratoire informatique entièrement équipé",
        },
        sub: {
          ar: "يضم المجمع مخبر حاسوب يطور فيه الطلاب مهاراتهم الرقمية إلى جانب المناهج الأكاديمية.",
          en: "The complex includes a computer lab where our students build digital skills alongside their academic curriculum.",
          fr: "Le complexe comprend un laboratoire informatique où nos élèves développent des compétences numériques en plus du cursus académique.",
        },
      },
    ],
    remote: {
      ar: "التسجيل عن بُعد مفتوح حاليًا للطلاب المقيمين خارج تشاد، مع نفس المنهج الدراسي ومتابعة كاملة للتقدم الدراسي وتواصل مع المعلمين.",
      en: "Remote enrollment is currently open to students residing outside Chad, following the same curriculum with full progress tracking and teacher communication.",
      fr: "L'inscription à distance est actuellement ouverte aux élèves résidant hors du Tchad, avec le même programme, un suivi complet et une communication avec les enseignants.",
    },
  },
  about: {
    intro: {
      ar: "مجمع المجد التعليمي العربي، رائد التعليم الناطق بالعربية في نجامينا، يقدم تعليمًا متميزًا يمزج الأصالة بالعصرية، وفاءً لشعاره «عزيمة — جودة — قمة»، من الابتدائي حتى الثانوي. كما نقدم مسار التعلم عن بُعد لطلابنا في الخارج، بنفس المستوى الأكاديمي مع متابعة مستمرة من إدارة المدرسة.",
      en: "Madjd Educational Complex, a pioneer of Arabic-language education in N'Djamena, offers distinguished schooling that blends tradition and modernity, true to its motto “Determination - Quality - Excellence,” from primary through secondary school. We also offer a remote-learning track for our students abroad, at the same academic standard with continuous follow-up from the school administration.",
      fr: "Le Complexe Scolaire Al-Madjd, pionnier de l'enseignement en langue arabe à N'Djamena, offre une scolarité distinguée alliant tradition et modernité, fidèle à sa devise « Détermination - Qualité - Excellence », du primaire au secondaire. Nous offrons également un parcours d'enseignement à distance pour nos élèves à l'étranger, au même niveau académique avec un suivi continu de l'administration scolaire.",
    },
    vision: {
      ar: "أن نكون المؤسسة العربية الرائدة في التعليم بجمهورية تشاد، نموذجًا في الجودة والانضباط والتفوق الأكاديمي.",
      en: "To be Chad's leading Arabic-language educational institution, a model of quality, discipline and academic excellence.",
      fr: "Être l'institution arabe de référence en République du Tchad, un modèle de qualité, de discipline et d'excellence académique.",
    },
    mission: {
      ar: "تكوين جيل مؤمن بلغته وواثق من قدراته، عبر مناهج عصرية وأنشطة تربوية متنوعة، برعاية كريمة من أولياء الأمور وإدارة متمكنة.",
      en: "Preparing a generation proud of its language and confident in its abilities through modern curricula, varied activities and strong school governance.",
      fr: "Former une génération fière de sa langue et confiante en ses capacités, grâce à des programmes modernes, des activités variées et une gestion scolaire rigoureuse.",
    },
  },
  programs: {
    stages: [
      {
        id: "stage-1",
        name: { ar: STAGES[0].nameAr, en: STAGES[0].nameEn, fr: STAGES[0].nameFr },
        grades: STAGES[0].grades,
        icon: STAGES[0].icon,
        desc: {
          ar: "المرحلة الأساسية التي يكتسب فيها الطالب مهارات القراءة والكتابة والحساب، مع تعزيز اللغة العربية في جميع المواد.",
          en: "The foundational stage where students build reading, writing and arithmetic skills, with Arabic as the language of instruction.",
          fr: "Le cycle fondamental où l'élève acquiert la lecture, l'écriture et le calcul, avec l'arabe comme langue d'enseignement.",
        },
      },
      {
        id: "stage-2",
        name: { ar: STAGES[1].nameAr, en: STAGES[1].nameEn, fr: STAGES[1].nameFr },
        grades: STAGES[1].grades,
        icon: STAGES[1].icon,
        desc: {
          ar: "إعداد أكاديمي متين يوازن بين العلوم والمواد الأدبية، مع التربية الإسلامية والأنشطة التربوية.",
          en: "Solid academic preparation balancing sciences and humanities, alongside Islamic education and school activities.",
          fr: "Une préparation académique solide équilibrant sciences et lettres, avec l'éducation islamique et les activités scolaires.",
        },
      },
      {
        id: "stage-3",
        name: { ar: STAGES[2].nameAr, en: STAGES[2].nameEn, fr: STAGES[2].nameFr },
        grades: STAGES[2].grades,
        icon: STAGES[2].icon,
        desc: {
          ar: "تحضير الطالب للبكالوريا بمسارات علمية وأدبية، مع مرافقة مكثفة لضمان التفوق.",
          en: "Intensive preparation for the Baccalaureate through scientific and literary tracks, with close coaching for excellence.",
          fr: "Préparation intensive au Baccalauréat en filières scientifique et littéraire, avec un accompagnement rapproché pour l'excellence.",
        },
      },
    ],
  },
  admissions: {
    text: {
      ar: "يستقبل مجمع المجد التعليمي العربي الملفات على مدار السنة الدراسية. لضمان استكمال تسجيلكم في الوقت المناسب، ننصح بالتواصل مع الإدارة مسبقًا في بداية كل دورة. التسجيل الحضوري للطلاب المقيمين في تشاد، والتسجيل عن بُعد لطلابنا في الخارج.",
      en: "Al-Madjd Educational Complex accepts enrollment files throughout the school year. To ensure timely registration, we recommend contacting the administration early in each term. In-person enrollment is open to students residing in Chad, and remote enrollment to our students abroad.",
      fr: "Le Complexe Scolaire Al-Madjd reçoit les dossiers d'inscription tout au long de l'année. Pour une inscription en temps voulu, nous conseillons de contacter l'administration au début de chaque session. Inscription en présentiel pour les élèves résidant au Tchad, et à distance pour nos élèves à l'étranger.",
    },
  },
  contact: {
    extra: {
      ar: "مرحبًا بكم في مجمع المجد التعليمي العربي. فريق الإدارة جاهز للإجابة عن استفساراتكم حول التسجيل أو الدراسة أو أي سؤال آخر خلال أوقات العمل.",
      en: "Welcome to Al-Madjd Educational Complex. Our administration team is ready to answer any questions about admissions, studies, or anything else during working hours.",
      fr: "Bienvenue au Complexe Scolaire Al-Madjd. Notre équipe administrative est prête à répondre à vos questions sur les admissions, les études ou tout autre sujet pendant les heures de travail.",
    },
  },
};

function text(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function localeText(v: unknown, fallback: LocaleText): LocaleText {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return {
      ar: text(o.ar, fallback.ar),
      en: text(o.en, fallback.en),
      fr: text(o.fr, fallback.fr),
    };
  }
  return fallback;
}

function strList(v: unknown, fallback: string[]): string[] {
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim())) {
    return (v as string[]).map((x) => x.trim());
  }
  return fallback;
}

function achievementList(v: unknown, fallback: Achievement[]): Achievement[] {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  return v.map((raw, i) => {
    const a = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const base = fallback[i] ?? fallback[fallback.length - 1];
    return {
      id: text(a.id, `achievement-${i + 1}`),
      title: localeText(a.title, base.title),
      sub: localeText(a.sub, base.sub),
    };
  });
}

function stageList(v: unknown, fallback: Stage[]): Stage[] {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  return v.map((raw, i) => {
    const s = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const base = fallback[i] ?? fallback[fallback.length - 1];
    return {
      id: text(s.id, `stage-${i + 1}`),
      name: localeText(s.name, base.name),
      grades: text(s.grades, base.grades),
      desc: localeText(s.desc, base.desc),
      icon: text(s.icon, base.icon),
    };
  });
}

export function resolveSettings(raw: Record<string, unknown> | null | undefined): SiteSettings {
  if (!raw) return DEFAULT_SETTINGS;
  const general = raw.general as Record<string, unknown> | undefined;
  const home = raw.home as Record<string, unknown> | undefined;
  const about = raw.about as Record<string, unknown> | undefined;
  const programs = raw.programs as Record<string, unknown> | undefined;
  const admissions = raw.admissions as Record<string, unknown> | undefined;
  const contact = raw.contact as Record<string, unknown> | undefined;
  return {
    general: {
      name: localeText(general?.name, DEFAULT_SETTINGS.general.name),
      motto: localeText(general?.motto, DEFAULT_SETTINGS.general.motto),
      logoUrl: text(general?.logoUrl, DEFAULT_SETTINGS.general.logoUrl),
      phones: strList(general?.phones, DEFAULT_SETTINGS.general.phones),
      email: text(general?.email, DEFAULT_SETTINGS.general.email),
      address: localeText(general?.address, DEFAULT_SETTINGS.general.address),
      mapUrl: text(general?.mapUrl, DEFAULT_SETTINGS.general.mapUrl),
    },
    home: {
      heroTitle: localeText(home?.heroTitle, DEFAULT_SETTINGS.home.heroTitle),
      heroSubtitle: localeText(home?.heroSubtitle, DEFAULT_SETTINGS.home.heroSubtitle),
      heroCta: localeText(home?.heroCta, DEFAULT_SETTINGS.home.heroCta),
      achievements: achievementList(home?.achievements, DEFAULT_SETTINGS.home.achievements),
      remote: localeText(home?.remote, DEFAULT_SETTINGS.home.remote),
    },
    about: {
      intro: localeText(about?.intro, DEFAULT_SETTINGS.about.intro),
      vision: localeText(about?.vision, DEFAULT_SETTINGS.about.vision),
      mission: localeText(about?.mission, DEFAULT_SETTINGS.about.mission),
    },
    programs: {
      stages: stageList(programs?.stages, DEFAULT_SETTINGS.programs.stages),
    },
    admissions: {
      text: localeText(admissions?.text, DEFAULT_SETTINGS.admissions.text),
    },
    contact: {
      extra: localeText(contact?.extra, DEFAULT_SETTINGS.contact.extra),
    },
  };
}

/** Fetches the raw stored settings blob (empty object when none saved yet). */
export async function fetchRawSettings(): Promise<Record<string, unknown>> {
  const res = await api.get<{ settings: Record<string, unknown> }>("/api/site-settings");
  return res.ok && res.data ? (res.data.settings ?? {}) : {};
}

/** Fetches stored settings, merged with defaults so the site never goes blank. */
export async function fetchSettings(): Promise<SiteSettings> {
  return resolveSettings(await fetchRawSettings());
}

/** Saves the full settings object (super_admin only). */
export async function saveSettings(settings: SiteSettings): Promise<{ saved?: boolean; error?: string }> {
  const res = await api.put<{ settings: SiteSettings }>("/api/site-settings", settings);
  return res.ok ? { saved: true } : { error: res.error };
}

/** Uploads a site image (logo); returns the public /media URL or an error message. */
export function uploadSiteImage(file: File): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  return api
    .upload<{ url: string }>("/api/media/cover", form)
    .then((res) => (res.ok ? { url: res.data?.url } : { error: res.error }));
}

/** Picks the localised string for the current locale (fallback chain ar > en > fr). */
export function pickText(t: LocaleText, locale: "ar" | "en" | "fr"): string {
  if (locale === "ar") return t.ar || t.en || t.fr;
  if (locale === "fr") return t.fr || t.en || t.ar;
  return t.en || t.ar || t.fr;
}

// ---------------------------------------------------------------------------
// Context + hook (kept in this non-component module so the provider file stays
// a pure single-component module for React Fast Refresh).
// ---------------------------------------------------------------------------

export type SiteSettingsContextValue = {
  /** Settings merged with defaults (always safe to render). */
  settings: SiteSettings;
  loading: boolean;
};

export const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  }
  return ctx;
}