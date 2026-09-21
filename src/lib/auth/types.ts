export type Role = "super_admin" | "staff" | "teacher" | "student" | "parent";

/** Optional duties selectable for staff accounts; each grants desk modules. */
export type StaffDuty = "registrar" | "academic" | "accountant" | "supervisor";

export type User = {
  id: string;
  email: string;
  nameAr: string;
  nameEn: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  /** Optional link to a Staff record in the school document (teachers). */
  staffId?: string;
  /** Optional link to a Student record in the school document (students). */
  studentId?: string;
  /**
   * Optional link to the single Student a parent account is bound to
   * (one-to-one; DB-enforced unique). Only set for role "parent".
   */
  parentStudentId?: string;
  /** Staff duties granted to this account (non-staff roles always have none). */
  duties: StaffDuty[];
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  userId: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
};

export type SafeUser = Omit<User, "passwordHash">;

export const ROLE_LABELS: Record<Role, { ar: string; en: string; fr: string }> = {
  super_admin: { ar: "مدير النظام", en: "Super Admin", fr: "Super Admin" },
  staff: { ar: "موظف", en: "Staff", fr: "Personnel" },
  teacher: { ar: "أستاذ", en: "Teacher", fr: "Enseignant" },
  student: { ar: "طالب", en: "Student", fr: "Étudiant" },
  parent: { ar: "ولي أمر", en: "Parent", fr: "Parent" },
};

export const ROLE_REDIRECTS: Record<Role, string> = {
  super_admin: "/app/admin",
  staff: "/app/staff",
  teacher: "/app/teacher",
  student: "/app/student",
  // Parent Portal page lands in a later task; the API/session foundation
  // (login + parent endpoints) works without it.
  parent: "/app/parent",
};

export const DUTY_LABELS: Record<StaffDuty, { ar: string; fr: string }> = {
  registrar: { ar: "أمين السجل (الطلاب)", fr: "Registraire" },
  academic: { ar: "الشؤون الدراسية (الفصول والمواد)", fr: "Académique" },
  accountant: { ar: "المحاسبة (الرسوم والدفعات)", fr: "Comptable" },
  supervisor: { ar: "الإشراف (الحضور)", fr: "Surveillant" },
};

const ALL_DUTIES = new Set<StaffDuty>(["registrar", "academic", "accountant", "supervisor"]);

/** Parses a stored comma-separated duties string into a sanitized array. */
export function parseDuties(value: string | null | undefined): StaffDuty[] {
  if (!value) return [];
  return value
    .split(",")
    .map((d) => d.trim())
    .filter((d): d is StaffDuty => ALL_DUTIES.has(d as StaffDuty));
}

/** Returns the role the loaded user row maps to; null for unknown roles. */
export function roleFromLabel(label: string | null | undefined): Role | null {
  if (!label) return null;
  if (label in ROLE_LABELS) return label as Role;
  // Tolerate lowercase/flexible input from forms.
  const lower = label.toLowerCase();
  if (lower === "super_admin") return "super_admin";
  if (lower === "staff") return "staff";
  if (lower === "teacher") return "teacher";
  if (lower === "student") return "student";
  return null;
}
