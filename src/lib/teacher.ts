import { api } from "@/lib/api";
import type { Grade, Student, Subject, Term, TimetableEntry } from "@/lib/types";

export type TeacherClass = {
  id: string;
  nameAr: string;
  nameFr?: string;
  level?: string;
  section?: string;
  capacity?: number;
  teacherStaffId?: string;
  /** True when this teacher is the head teacher (المعلم المسؤول) of this class. */
  isHeadOfClass: boolean;
  /** Weekly slots (day/slot → subject) for this class, restricted to the teacher's own subjects. */
  timetable: TimetableEntry[];
  students: Student[];
  subjects: Subject[];
  grades: Grade[];
};

export type TeacherPortfolio = {
  staffId: string | null;
  staffName?: string;
  terms: Term[];
  classes: TeacherClass[];
};

/** Loads the teaching portfolio for the signed-in teacher. */
export async function getTeacherPortfolio(): Promise<TeacherPortfolio> {
  const res = await api.get<{ portfolio: TeacherPortfolio }>("/api/teacher");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل بيانات الفصول");
  return (res.data?.portfolio ?? { staffId: null, terms: [], classes: [] }) as TeacherPortfolio;
}

export type UpsertGradePayload = {
  studentId: string;
  subjectId: string;
  termId: string;
  /** Number to save or `null` to clear the grade. */
  score: number | null;
};

/** Saves (or clears) a single grade; only for the teacher's own classes/subjects. */
export async function saveTeacherGrade(payload: UpsertGradePayload): Promise<void> {
  const res = await api.post<{ saved: boolean }>("/api/teacher", payload);
  if (!res.ok) throw new Error(res.error ?? "تعذر حفظ الدرجة");
}