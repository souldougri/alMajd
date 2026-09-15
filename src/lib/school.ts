export const SCHOOL = {
  nameAr: "مجمع المجد التعليمي العربي",
  nameEn: "Madjd Educational Complex",
  nameFr: "Complexe Scolaire Al-Madjd",
  shortAr: "مجمع المجد",
  shortFr: "Al-Madjd",
  countryAr: "جمهورية تشاد",
  countryFr: "République du Tchad",
  motto: "عزيمة — جودة — قمة",
  mottoEn: "Determination — Quality — Excellence",
  mottoFr: "Détermination — Qualité — Excellence",
  year: "2026–2027",
  city: "نجامينا",
  cityEn: "N'Djamena",
  logo: "/brand/logo.jpg",
  currency: "F CFA",
  phones: ["+235 66 31 39 29", "+966 54 762 4469"],
  email: "admin@madjd.org",
} as const;

export const CLASSES = [
  "روضة أ",
  "1 أ",
  "2 أ",
  "3 أ",
  "4 أ",
  "5 أ",
  "6 أ",
  "7 أ",
  "8 أ",
  "9 أ",
] as const;

export function money(n: number) {
  return `${n.toLocaleString("fr-FR")} ${SCHOOL.currency}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
