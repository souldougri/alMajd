import type { Payment, Student, Subject, Warning, WarningKind } from "@/lib/types";

export const WARNING_KIND_AR: Record<WarningKind, string> = {
  absence: "غياب",
  behavior: "سلوك",
  academic: "دراسي",
};

export const GENDER_AR: Record<Student["gender"], string> = {
  male: "ذكر",
  female: "أنثى",
};

export function formatPrintDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar-TN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function yearOf(iso: string): string {
  const y = iso.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : String(new Date().getFullYear());
}

/** Stable sequential number among sibling records in the same year (date then id). */
export function officialDocNo(
  prefix: string,
  isoDate: string,
  recordId: string,
  siblings: Array<{ id: string; date: string }>,
): string {
  const year = yearOf(isoDate);
  const sameYear = siblings
    .filter((x) => yearOf(x.date) === year)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let idx = sameYear.findIndex((x) => x.id === recordId) + 1;
  if (idx <= 0) {
    idx = hashIndex(recordId);
  }
  return `${prefix}-${year}-${String(idx).padStart(4, "0")}`;
}

function hashIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (h % 9000) + 1;
}

export function receiptNumber(payment: Payment, payments: Payment[]): string {
  return officialDocNo("REC", payment.date, payment.id, payments);
}

export function summonsNumber(
  isoDate: string,
  recordId: string,
  siblings: Array<{ id: string; date: string }>,
): string {
  return officialDocNo("SUM", isoDate, recordId, siblings);
}

/** Sequential admission document number for a student within their enrolment year. */
export function admissionNumber(student: Student, students: Student[]): string {
  const iso = student.enrolled || new Date().toISOString().slice(0, 10);
  return officialDocNo(
    "ADM",
    iso,
    student.id,
    students.map((s) => ({ id: s.id, date: s.enrolled || iso })),
  );
}

export function classSubjects(subjects: Subject[], classId: string | undefined): Subject[] {
  return subjects.filter((s) => s.active && (s.classId === classId || !s.classId));
}

export function formatScore(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function weightedPoints(score: number, maxScore: number, coefficient: number): number {
  if (!maxScore) return 0;
  return (score / maxScore) * 20 * coefficient;
}
