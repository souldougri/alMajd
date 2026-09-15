import { api } from "@/lib/api";
import type { Grade, Student, Subject, Term } from "@/lib/types";

export type StudentPayoutRow = { id: string; amount: number; date: string; note: string };
export type StudentWarningRow = { id: string; kind: string; date: string; body: string };
export type StudentAttendanceRow = { date: string; status: string };
export type StudentTimetableRow = { day: number; slot: number; subjectId: string };

export type StudentPortfolio = {
  student: Student | null;
  className: string;
  terms: Term[];
  subjects: Subject[];
  grades: Grade[];
  payments: StudentPayoutRow[];
  warnings: StudentWarningRow[];
  attendance: StudentAttendanceRow[];
  timetable: StudentTimetableRow[];
  publishedTerms: Record<string, boolean>;
  annualFee: number;
  paid: number;
  remaining: number;
};

/** Loads the read-only portfolio for the signed-in student. */
export async function getStudentPortfolio(): Promise<StudentPortfolio> {
  const res = await api.get<{ portfolio: StudentPortfolio }>("/api/student");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل البيانات");
  return (res.data?.portfolio ?? {
    student: null,
    className: "",
    terms: [],
    subjects: [],
    grades: [],
    payments: [],
    warnings: [],
    attendance: [],
    timetable: [],
    publishedTerms: {},
    annualFee: 0,
    paid: 0,
    remaining: 0,
  }) as StudentPortfolio;
}