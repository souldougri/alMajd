export type Gender = "male" | "female";
export type AttendanceStatus = "present" | "absent" | "late";
export type WarningKind = "absence" | "behavior" | "academic";
export type CertKind = "year" | "honor" | "attendance";

export type Student = {
  id: string;
  nameAr: string;
  nameFr: string;
  gender: Gender;
  klass: string;
  classId?: string; // Reference to ClassSection.id
  dob: string; // ISO YYYY-MM-DD
  placeOfBirth: string;
  parentAr: string;
  phone: string;
  enrolled: string;
  annualFee: number;
  photo?: string; // Base64 data URL for student photo
};

export type ClassSection = {
  id: string;
  nameAr: string;
  nameFr?: string;
  level?: string;
  section?: string;
  capacity?: number;
  teacherStaffId?: string;
  active: boolean;
};

export type Subject = {
  id: string;
  nameAr: string;
  nameFr?: string;
  code?: string;
  classId?: string; // Optional: link to specific class, or level-based
  teacherStaffId?: string; // Optional: link to teacher staff record
  coefficient: number;
  maxScore: number;
  active: boolean;
};

export type Term = {
  id: string;
  nameAr: string;
  nameFr?: string;
  order: number;
  active: boolean;
};

export type Grade = {
  id: string;
  studentId: string;
  subjectId: string;
  termId: string;
  score: number;
  maxScore: number; // Snapshot of subject.maxScore at time of entry
  date?: string;
  note?: string;
};

export type Staff = {
  id: string;
  nameAr: string;
  role: string;
  phone: string;
};

export type Payment = {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  note: string;
};

export type Warning = {
  id: string;
  studentId: string;
  kind: WarningKind;
  date: string;
  body: string;
};

export type AttendanceMap = Record<string, AttendanceStatus>;

export type FeeType = {
  id: string;
  nameAr: string;
  amount: number;
  active?: boolean;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  vendor?: string;
};

export type ExamSession = {
  id: string;
  name: string;
  termId: string;
  date: string;
};

export type TimetableEntry = {
  id: string;
  classId: string;
  day: number;
  slot: number;
  subjectId: string;
};
