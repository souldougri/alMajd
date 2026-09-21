import { api } from "@/lib/api";

/** Structural mirrors of the server report payloads (server module is server-only). */

export type ReportAssessment = {
  id: string;
  title: string;
  typeCode: string;
  date?: string;
  maxScore: number;
  score: number | null;
  percent: number | null;
};

export type ReportSubject = {
  subjectId: string;
  nameAr: string;
  coefficient: number;
  maxScore: number;
  teacherNameAr?: string;
  note?: string;
  assessments: ReportAssessment[];
  average20: number | null;
  weightedPoints: number | null;
  appreciation: string | null;
};

export type ReportCard = {
  student: {
    id: string;
    nameAr: string;
    nameFr: string;
    gender: string;
    dob: string;
    klass: string;
    enrolled: string;
  };
  branch: { id: string; nameAr: string };
  class: { id: string; nameAr: string };
  academicYear: { id: string; label: string };
  term: { id: string; nameAr: string };
  published: boolean;
  subjects: ReportSubject[];
  totalWeighted: number | null;
  totalCoefficient: number;
  average20: number | null;
  percentage: number | null;
  appreciation: string | null;
  rank: number | null;
  classSize: number;
};

export type ClassListEntry = {
  id: string;
  nameAr: string;
  nameFr: string;
  gender: string;
  klass: string;
  enrolled: string;
  status: string;
};

export type ClassStudentList = {
  branch: { id: string; nameAr: string };
  class: { id: string; nameAr: string };
  academicYear: { id: string; label: string };
  students: ClassListEntry[];
};

export type AdmissionDocument = {
  reference: string;
  student: {
    id: string;
    nameAr: string;
    nameFr: string;
    gender: string;
    dob: string;
    placeOfBirth: string;
    parentAr: string;
    phone: string;
    enrolled: string;
    annualFee: number;
  };
  branch: { id: string; nameAr: string };
  className: string;
  /** Portal login username when bound. Passwords are never exposed. */
  loginUsername: string | null;
  /** Parent portal login username when bound. Passwords are never exposed. */
  parentLoginUsername: string | null;
  /**
   * One-time passwords injected in memory at print time (registration modal).
   * Never returned by the server, never persisted — the sheet shows them only
   * when explicitly provided for immediate handover printing.
   */
  studentPassword?: string | null;
  parentPassword?: string | null;
};

/** One student's bulletin for one term (branch scope enforced server-side). */
export async function getReportCard(studentId: string, termId: string): Promise<ReportCard> {
  const res = await api.get<{ report: ReportCard }>(
    `/api/reports/students/${studentId}/report-card?termId=${encodeURIComponent(termId)}`,
  );
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل كشف الدرجات");
  return res.data?.report as ReportCard;
}

/** Printable roster of a class (branch scope enforced server-side). */
export async function getClassStudentList(classId: string): Promise<ClassStudentList> {
  const res = await api.get<{ roster: ClassStudentList }>(`/api/reports/classes/${classId}/students`);
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل قائمة الطلاب");
  return res.data?.roster as ClassStudentList;
}

/** Admission document of a student (branch scope enforced server-side). */
export async function getAdmissionDocument(studentId: string): Promise<AdmissionDocument> {
  const res = await api.get<{ document: AdmissionDocument }>(`/api/reports/students/${studentId}/admission`);
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل مستند التسجيل");
  return res.data?.document as AdmissionDocument;
}
