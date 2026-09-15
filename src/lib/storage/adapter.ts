import { seedAttendance, seedPayments, seedStaff, seedStudents, seedWarnings, FIXTURE_STAFF_IDS, FIXTURE_STUDENT_IDS } from "@/data/seed";
import { CLASSES, SCHOOL } from "@/lib/school";
import { CURRENT_SCHEMA_VERSION, type SchoolDatabaseDocument, type ValidationResult } from "./types";
import type { ClassSection, Subject, Term } from "@/lib/types";

export const STORAGE_KEY = "al-majd-school-data-v1";
export const LEGACY_STORAGE_KEY = "al-madjd-sis-v1";

/**
 * Creates baseline class sections from the hardcoded CLASSES list.
 * Uses stable IDs based on the class name for migration compatibility.
 */
function seedClasses(): ClassSection[] {
  return CLASSES.map((name) => ({
    id: `class-${name.replace(/\s+/g, "-").toLowerCase()}`,
    nameAr: name,
    nameFr: undefined,
    level: undefined,
    section: undefined,
    capacity: undefined,
    teacherStaffId: undefined,
    active: true,
  }));
}

/**
 * Creates baseline subjects (empty initially, as they're user-defined).
 */
function seedSubjects(): Subject[] {
  return [];
}

/**
 * Creates baseline terms (three standard terms).
 */
function seedTerms(): Term[] {
  return [
    { id: "term-1", nameAr: "الفصل الأول", nameFr: "Premier trimestre", order: 1, active: true },
    { id: "term-2", nameAr: "الفصل الثاني", nameFr: "Deuxième trimestre", order: 2, active: true },
    { id: "term-3", nameAr: "الفصل الثالث", nameFr: "Troisième trimestre", order: 3, active: true },
  ];
}

/**
 * Creates a baseline default document using existing seed data.
 */
export function createDefaultDocument(): SchoolDatabaseDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    system: {
      name: SCHOOL.nameAr,
      academicYear: SCHOOL.year,
      version: "1.0.0",
    },
    students: seedStudents,
    staff: seedStaff,
    payments: seedPayments,
    warnings: seedWarnings,
    attendance: seedAttendance,
    classes: seedClasses(),
    subjects: seedSubjects(),
    terms: seedTerms(),
    grades: [],
    feeTypes: [],
    expenses: [],
    examSessions: [],
    timetable: [],
    publishedResults: {},
  };
}

/**
 * Validates a candidate backup or parsed JSON object against the required schema.
 * Rejects invalid documents with clear Arabic error messages.
 */
export function validateBackupDocument(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      success: false,
      errorAr: "الملف المحدد لا يحتوي على كائن بيانات صالح بصيغة JSON.",
    };
  }

  const doc = raw as Record<string, unknown>;

  if (typeof doc.schemaVersion !== "number" || doc.schemaVersion <= 0) {
    return {
      success: false,
      errorAr: "إصدار المخطط (schemaVersion) مفقود أو غير صالح في ملف النسخة الاحتياطية.",
    };
  }

  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      errorAr: `إصدار النسخة الاحتياطية (${doc.schemaVersion}) أحدث من إصدار النظام الحالي (${CURRENT_SCHEMA_VERSION}). يرجى تحديث النظام أولاً.`,
    };
  }

  if (!Array.isArray(doc.students)) {
    return {
      success: false,
      errorAr: "قائمة الطلاب (students) مفقودة أو غير صالحة في ملف النسخة الاحتياطية.",
    };
  }

  if (!Array.isArray(doc.staff)) {
    return {
      success: false,
      errorAr: "قائمة الكادر (staff) مفقودة أو غير صالحة في ملف النسخة الاحتياطية.",
    };
  }

  if (!Array.isArray(doc.payments)) {
    return {
      success: false,
      errorAr: "سجلات الرسوم والمدفوعات (payments) مفقودة أو غير صالحة.",
    };
  }

  if (!Array.isArray(doc.warnings)) {
    return {
      success: false,
      errorAr: "سجلات الإنذارات (warnings) مفقودة أو غير صالحة.",
    };
  }

  if (!doc.attendance || typeof doc.attendance !== "object" || Array.isArray(doc.attendance)) {
    return {
      success: false,
      errorAr: "سجلات الحضور والغياب (attendance) مفقودة أو غير صالحة.",
    };
  }

  if (!Array.isArray(doc.classes)) {
    return {
      success: false,
      errorAr: "قائمة الفصول (classes) مفقودة أو غير صالحة.",
    };
  }

  if (!Array.isArray(doc.subjects)) {
    return {
      success: false,
      errorAr: "قائمة المواد (subjects) مفقودة أو غير صالحة.",
    };
  }

  if (!Array.isArray(doc.terms)) {
    return {
      success: false,
      errorAr: "قائمة الفصول الدراسية (terms) مفقودة أو غير صالحة.",
    };
  }

  if (!Array.isArray(doc.grades)) {
    return {
      success: false,
      errorAr: "سجلات الدرجات (grades) مفقودة أو غير صالحة.",
    };
  }

  // Validate students structural integrity
  for (let i = 0; i < doc.students.length; i++) {
    const s = doc.students[i];
    if (
      !s ||
      typeof s !== "object" ||
      typeof (s as Record<string, unknown>).id !== "string" ||
      typeof (s as Record<string, unknown>).nameAr !== "string" ||
      typeof (s as Record<string, unknown>).klass !== "string"
    ) {
      return {
        success: false,
        errorAr: `بيانات الطالب في السطر ${i + 1} غير مكتملة أو تفتقر إلى المعرف أو الاسم أو الصف.`,
      };
    }
  }

  return {
    success: true,
    data: doc as unknown as SchoolDatabaseDocument,
  };
}

/**
 * Migrates a document from schema version 1 to 2 by adding the photo field.
 */
function migrateToV2(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  return {
    ...doc,
    schemaVersion: 2,
    students: doc.students.map((s) => ({
      ...s,
      photo: s.photo ?? undefined,
    })),
  };
}

/**
 * Migrates a document from schema version 2 to 3 by adding classes and subjects.
 * Seeds classes from CLASSES and links students via classId.
 */
function migrateToV3(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  const classes = seedClasses();
  const classMap = new Map(classes.map((c) => [c.nameAr, c.id]));

  return {
    ...doc,
    schemaVersion: 3,
    classes,
    subjects: seedSubjects(),
    students: doc.students.map((s) => ({
      ...s,
      classId: classMap.get(s.klass),
    })),
  };
}

/**
 * Migrates a document from schema version 3 to 4 by adding terms and grades.
 */
function migrateToV4(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  return {
    ...doc,
    schemaVersion: 4,
    terms: seedTerms(),
    grades: [],
  };
}

/**
 * Migrates a document from schema version 4 to 5 by adding placeOfBirth
 * (string, default "") to every student.
 */
function migrateToV5(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  return {
    ...doc,
    schemaVersion: 5,
    students: doc.students.map((s) => ({
      ...s,
      placeOfBirth: s.placeOfBirth ?? "",
    })),
  };
}

/**
 * Migrates a document from schema version 5 to 6 by adding the workspace
 * extensions: fee types, expenses, exam sessions and the minimal timetable.
 * All new collections are optional and default to empty arrays.
 */
function migrateToV6(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  return {
    ...doc,
    schemaVersion: 6,
    feeTypes: doc.feeTypes ?? [],
    expenses: doc.expenses ?? [],
    examSessions: doc.examSessions ?? [],
    timetable: doc.timetable ?? [],
  };
}

/**
 * Strips legacy fixture rows (fake seeded desktop staff / demo students) from
 * a stored document so teacher pickers and student lists never show them.
 * Also clears teacherStaffId references that pointed at fixture staff IDs.
 */
function stripFixtures(doc: SchoolDatabaseDocument): SchoolDatabaseDocument {
  const fixtureStaff = FIXTURE_STAFF_IDS;
  const fixtureStudents = FIXTURE_STUDENT_IDS;

  const students = doc.students.filter((s) => !fixtureStudents.has(s.id));
  const staff = doc.staff.filter((s) => !fixtureStaff.has(s.id));
  const payments = doc.payments.filter((p) => !fixtureStudents.has(p.studentId));
  const warnings = doc.warnings.filter((w) => !fixtureStudents.has(w.studentId));

  const attendance: SchoolDatabaseDocument["attendance"] = {};
  for (const [date, dayMap] of Object.entries(doc.attendance)) {
    const day: Record<string, "present" | "absent" | "late"> = {};
    for (const [sid, status] of Object.entries(dayMap)) {
      if (!fixtureStudents.has(sid)) day[sid] = status;
    }
    if (Object.keys(day).length > 0) attendance[date] = day;
  }

  const classes = doc.classes.map((c) => ({
    ...c,
    teacherStaffId: c.teacherStaffId && fixtureStaff.has(c.teacherStaffId) ? undefined : c.teacherStaffId,
  }));
  const subjects = doc.subjects.map((s) => ({
    ...s,
    teacherStaffId: s.teacherStaffId && fixtureStaff.has(s.teacherStaffId) ? undefined : s.teacherStaffId,
  }));

  return { ...doc, students, staff, payments, warnings, attendance, classes, subjects };
}

/**
 * Loads the school document.
 * Checks for the new storage key first; if absent, transparently migrates from legacy "al-madjd-sis-v1".
 */
export function loadSchoolDocument(): SchoolDatabaseDocument {
  if (typeof window === "undefined" || !window.localStorage) {
    return createDefaultDocument();
  }

  try {
    // 1. Check primary versioned storage
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      const validation = validateBackupDocument(parsed);
      if (validation.success) {
        let doc = stripFixtures(validation.data);
        // Handle schema migration
        if (doc.schemaVersion === 1) {
          doc = migrateToV2(doc);
        }
        if (doc.schemaVersion === 2) {
          doc = migrateToV3(doc);
        }
        if (doc.schemaVersion === 3) {
          doc = migrateToV4(doc);
        }
        if (doc.schemaVersion === 4) {
          doc = migrateToV5(doc);
        }
        if (doc.schemaVersion === 5) {
          doc = migrateToV6(doc);
        }
        if (doc.schemaVersion !== CURRENT_SCHEMA_VERSION) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        }
        return doc;
      }
    }

    // 2. Check legacy storage for migration
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      const legacyState = legacyParsed.state || legacyParsed;

      if (legacyState && Array.isArray(legacyState.students)) {
        const classes = seedClasses();
        const classMap = new Map(classes.map((c) => [c.nameAr, c.id]));

        const migratedDoc: SchoolDatabaseDocument = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          system: {
            name: SCHOOL.nameAr,
            academicYear: SCHOOL.year,
            version: "1.0.0",
          },
          students: legacyState.students.map((s: any) => ({
            ...s,
            classId: classMap.get(s.klass),
            placeOfBirth: s.placeOfBirth ?? "",
          })),
          staff: Array.isArray(legacyState.staff) ? legacyState.staff : seedStaff,
          payments: Array.isArray(legacyState.payments) ? legacyState.payments : seedPayments,
          warnings: Array.isArray(legacyState.warnings) ? legacyState.warnings : seedWarnings,
          attendance:
            legacyState.attendance && typeof legacyState.attendance === "object"
              ? legacyState.attendance
              : seedAttendance,
          classes,
          subjects: seedSubjects(),
          terms: seedTerms(),
          grades: [],
          feeTypes: [],
          expenses: [],
          examSessions: [],
          timetable: [],
        };

        // Persist migrated document to new key
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripFixtures(migratedDoc)));
        return stripFixtures(migratedDoc);
      }
    }
  } catch (err) {
    console.error("[StorageAdapter] Error loading school document:", err);
  }

  // 3. Fall back to clean seed data and initialize storage
  const defaultDoc = createDefaultDocument();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDoc));
  } catch (err) {
    console.error("[StorageAdapter] Error writing default document:", err);
  }
  return defaultDoc;
}

/**
 * Persists the school database document atomically to localStorage.
 */
export function saveSchoolDocument(doc: SchoolDatabaseDocument): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const payload: SchoolDatabaseDocument = {
    ...doc,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  localStorage.setItem(STORAGE_KEY, serialized);

  // Keep legacy Zustand persist key synchronized for backwards compatibility
  try {
    const legacyPayload = {
      state: {
        students: payload.students,
        staff: payload.staff,
        payments: payload.payments,
        warnings: payload.warnings,
        attendance: payload.attendance,
      },
      version: 0,
    };
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyPayload));
  } catch {
    // Non-critical if legacy key fails
  }
}

/**
 * Returns formatted filename for backups: al-majd-backup-YYYYMMDD.json
 */
export function getBackupFilename(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `al-majd-backup-${year}${month}${day}.json`;
}

/**
 * Triggers a browser download of the given document as a JSON file.
 */
export function downloadBackupFile(doc: SchoolDatabaseDocument): void {
  const payload: SchoolDatabaseDocument = {
    ...doc,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getBackupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
