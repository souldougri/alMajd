export const BRAND = {
  navy: "#14324D",
  gold: "#D89A3E",
  bg: "#FAF6EE",
  white: "#FFFFFF",
  navyDark: "#0E2238",
  goldLight: "#E8B96A",
  bgSubtle: "#F0E8D8",
} as const;

export const CONTACT = {
  phones: ["+235 66 31 39 29", "+966 54 762 4469"],
  email: "admin@madjd.org",
  emailGulf: "h.hamitay51@gmail.com",
  branches: [
    { nameAr: "فرع الشايوط", nameFr: "Succursale Chawir", desc: "الشايوط، مقابل مقر البلدية الرابعة" },
    { nameAr: "فرع غوز توري", nameFr: "Succursale Gouz Toré", desc: "غوز توري، الحي العاشر، مقابل مسجد التوب أحمار" },
    { nameAr: "فرع دينغاسوا", nameFr: "Succursale Dingasoua", desc: "حي دينغاسوا" },
    { nameAr: "فرع عن بعد - السعودية", nameFr: "Succursale à distance - KSA", desc: "المملكة العربية السعودية، الرياض" },
  ],
} as const;

export const STAGES = [
  { nameAr: "الابتدائي", nameEn: "Primary", nameFr: "Primaire", grades: "1 – 6", icon: "📚" },
  { nameAr: "الإعدادي", nameEn: "Preparatory", nameFr: "Préparatoire", grades: "7 – 9", icon: "🎓" },
  { nameAr: "الثانوي", nameEn: "Secondary", nameFr: "Secondaire", grades: "10 – 12", icon: "🏛" },
] as const;

export const MOTTO = {
  ar: "عزيمة — جودة — قمة",
  en: "Determination — Quality — Excellence",
  fr: "Détermination — Qualité — Excellence",
} as const;

export const LINKS = {
  nav: [
    { href: "/", label: { ar: "الرئيسية", en: "Home", fr: "Accueil" } },
    { href: "/about", label: { ar: "من نحن", en: "About", fr: "À propos" } },
    { href: "/programs", label: { ar: "البرامج", en: "Programs", fr: "Programmes" } },
    { href: "/admissions", label: { ar: "التسجيل", en: "Admissions", fr: "Admissions" } },
    { href: "/contact", label: { ar: "اتصل بنا", en: "Contact", fr: "Contact" } },
    { href: "/news", label: { ar: "الأخبار", en: "News", fr: "Actualités" } },
  ],
} as const;

export type Locale = "ar" | "en" | "fr";
