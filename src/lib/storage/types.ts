import type { AttendanceMap, ClassSection, ExamSession, Expense, FeeType, Grade, Payment, Staff, Student, Subject, Term, TimetableEntry, Warning } from "@/lib/types";

export const CURRENT_SCHEMA_VERSION = 6;

export interface SchoolDatabaseDocument {
  schemaVersion: number;
  exportedAt?: string;
  system?: {
    name: string;
    academicYear: string;
    version?: string;
  };
  students: Student[];
  staff: Staff[];
  payments: Payment[];
  warnings: Warning[];
  attendance: Record<string, AttendanceMap>;
  classes: ClassSection[];
  subjects: Subject[];
  terms: Term[];
  grades: Grade[];
  /** Types de frais configurables (محاسبة). */
  feeTypes?: FeeType[];
  /** سجل الإنفاق اليومي (فاتورة إنفاق). */
  expenses?: Expense[];
  /** جلسات الامتحان الاختيارية (اسم + فصل دراسي + تاريخ). */
  examSessions?: ExamSession[];
  /** الجدول الزمني الأدنى: صف × يوم أسبوعي × فترة → مادة. */
  timetable?: TimetableEntry[];
  /** مفاتيح `${classId}::${termId}` للفصول/الفترات التي نُشرت نتائجها لبورطات الطلاب. */
  publishedResults?: Record<string, boolean>;
  // Future extensions placeholder:
  grades_summary?: unknown[];
}

export type ValidationResult =
  | { success: true; data: SchoolDatabaseDocument }
  | { success: false; errorAr: string };
