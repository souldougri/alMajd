/**
 * Server-side school data operations for the teacher and student portals.
 *
 * Reads and writes the versioned school document stored server-side
 * (PostgreSQL or PGLite). Server-only module — never import from client code.
 */
import { getSchoolDocumentRow, saveSchoolDocumentRow, uid, writeAudit } from "./auth";
import { ApiError } from "./http";
import type { SafeUser } from "@/lib/auth/types";
import type { SchoolDatabaseDocument } from "@/lib/storage/types";
import type { ClassSection, Grade, Student, Subject, Term, TimetableEntry } from "@/lib/types";

async function getRequiredDocument(): Promise<SchoolDatabaseDocument> {
  const row = await getSchoolDocumentRow();
  if (!row) {
    throw new ApiError("بيانات المدرسة غير مرفوعة بعد على الخادم");
  }
  return row.document as unknown as SchoolDatabaseDocument;
}

function studentInClass(student: Student, classSection: ClassSection): boolean {
  return student.classId
    ? student.classId === classSection.id
    : student.klass !== undefined && student.klass === classSection.nameAr;
}

/** Validates and returns the list of active terms, ordered by `order`. */
function activeTerms(doc: SchoolDatabaseDocument): Term[] {
  return [...doc.terms].filter((t) => t.active).sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Teacher portal
// ---------------------------------------------------------------------------

export type TeacherPortfolio = {
  staffId: string | null;
  staffName?: string;
  terms: Term[];
  classes: Array<{
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
  }>;
};

export async function getTeacherPortfolio(user: SafeUser): Promise<TeacherPortfolio> {
  if (user.role !== "teacher") {
    return { staffId: null, terms: [], classes: [] };
  }
  const doc = await getRequiredDocument();
  const teacherStaffId = user.id;

  // A subject belongs to a teacher's class when it:
  // - is active,
  // - targets that class (classId matches) or all classes (no classId), and
  // - is assigned to this teacher, or not assigned to anyone yet.
  const classSubjectsForTeacher = (cls: ClassSection) =>
    doc.subjects.filter(
      (s) =>
        s.active &&
        (!s.classId || s.classId === cls.id) &&
        (!s.teacherStaffId || s.teacherStaffId === teacherStaffId),
    );

  // A class appears for a teacher when they are the class teacher, or when at
  // least one subject (for this class or for all classes) is assigned to them.
  const teacherClasses = doc.classes.filter(
    (c) =>
      c.active &&
      (c.teacherStaffId === teacherStaffId ||
        doc.subjects.some(
          (s) =>
            s.active &&
            s.teacherStaffId === teacherStaffId &&
            (!s.classId || s.classId === c.id),
        )),
  );

  const classes = teacherClasses.map((cls) => {
    const students = doc.students.filter((s) => studentInClass(s, cls));
    const studentIds = new Set(students.map((s) => s.id));
    const subjects = classSubjectsForTeacher(cls);
    const grades = doc.grades.filter((g) => studentIds.has(g.studentId));
    const teacherSubjectIds = new Set(subjects.map((s) => s.id));
    return {
      id: cls.id,
      nameAr: cls.nameAr,
      nameFr: cls.nameFr,
      level: cls.level,
      section: cls.section,
      capacity: cls.capacity,
      teacherStaffId: cls.teacherStaffId,
      isHeadOfClass: cls.teacherStaffId === teacherStaffId,
      timetable: (doc.timetable ?? []).filter(
        (t) => t.classId === cls.id && teacherSubjectIds.has(t.subjectId),
      ),
      students,
      subjects,
      grades,
    };
  });

  return { staffId: user.id, staffName: user.nameAr, terms: activeTerms(doc), classes };
}

export type UpsertGradeResult = {
  saved: boolean;
  studentGrades: Grade[];
};

/**
 * Teacher upserts (or clears) a single grade. The subject must belong to one
 * of the teacher's own classes and the student must be enrolled in that class.
 */
export async function upsertTeacherGrade(
  user: SafeUser,
  body: { studentId?: unknown; subjectId?: unknown; termId?: unknown; score?: unknown },
): Promise<UpsertGradeResult> {
  if (user.role !== "teacher") {
    throw new ApiError("حساب الأستاذ غير صالح. تواصل مع مدير النظام.", 403);
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const termId = typeof body.termId === "string" ? body.termId : "";

  const doc = await getRequiredDocument();

  const subject = doc.subjects.find((s) => s.id === subjectId && s.active);
  if (!subject) {
    throw new ApiError("المادة غير موجودة أو غير نشطة");
  }

  // Reject teachers who aren't assigned to the subject.
  if (subject.teacherStaffId && subject.teacherStaffId !== user.id) {
    throw new ApiError("هذه المادة غير موكلة إليك");
  }

  // The teacher must belong to the class exactly as the portfolio shows it:
  // either they are the head teacher, or they own a subject targeting the
  // class. Mirrors getTeacherPortfolio so everything the teacher sees in the
  // UI is actually saveable (previously subject-only teachers were rejected).
  const teacherClass = doc.classes.find(
    (c) =>
      c.active &&
      (!subject.classId || c.id === subject.classId) &&
      (c.teacherStaffId === user.id ||
        doc.subjects.some(
          (s) => s.active && s.teacherStaffId === user.id && (!s.classId || s.classId === c.id),
        )),
  );
  if (!teacherClass) {
    throw new ApiError("هذه المادة ليست ضمن الفصول الموكلة إليك");
  }

  const student = doc.students.find((s) => s.id === studentId && studentInClass(s, teacherClass));
  if (!student) {
    throw new ApiError("الطالب غير مسجل في هذا الفصل");
  }

  const term = doc.terms.find((t) => t.id === termId && t.active);
  if (!term) {
    throw new ApiError("الفصل الدراسي غير موجود أو غير نشط");
  }

  const maxScore = subject.maxScore;
  const nextGrades = doc.grades.filter(
    (g) => !(g.studentId === studentId && g.subjectId === subjectId && g.termId === termId),
  );

  if (body.score !== null && body.score !== undefined && body.score !== "") {
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      throw new ApiError(`الدرجة يجب أن تكون رقماً بين 0 و ${maxScore}`);
    }
    nextGrades.push({
      id: uid("g"),
      studentId,
      subjectId,
      termId,
      score,
      maxScore,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  // CRITICAL: persist the mutated grade list back into the document.
  // Previously the array was built but never assigned, so the DB stayed
  // unchanged while the response claimed success.
  doc.grades = nextGrades;

  await saveSchoolDocumentRow(doc, doc.schemaVersion);

  await writeAudit({
    action: "grade.entry",
    actorId: user.id,
    actorName: user.nameAr,
    targetId: studentId,
    targetName: student.nameAr,
    detail: `${subject.nameAr} · ${term.nameAr} · ${String(body.score ?? "cleared")}/${maxScore}`,
  });

  return {
    saved: true,
    studentGrades: nextGrades.filter((g) => g.studentId === studentId),
  };
}

// ---------------------------------------------------------------------------
// Student portal
// ---------------------------------------------------------------------------

export type StudentPortfolio = {
  student: Student | null;
  className: string;
  terms: Term[];
  subjects: Subject[];
  grades: Grade[];
  payments: Array<{ id: string; amount: number; date: string; note: string }>;
  warnings: Array<{ id: string; kind: string; date: string; body: string }>;
  attendance: Array<{ date: string; status: string }>;
  timetable: Array<{ day: number; slot: number; subjectId: string }>;
  /** termId → true when the class bulletin for that term was published. */
  publishedTerms: Record<string, boolean>;
  annualFee: number;
  paid: number;
  remaining: number;
};

export async function getStudentPortfolio(user: SafeUser): Promise<StudentPortfolio> {
  const empty = {
    student: null,
    className: "",
    terms: [] as Term[],
    subjects: [] as Subject[],
    grades: [] as Grade[],
    payments: [],
    warnings: [],
    attendance: [] as Array<{ date: string; status: string }>,
    timetable: [] as Array<{ day: number; slot: number; subjectId: string }>,
    publishedTerms: {} as Record<string, boolean>,
    annualFee: 0,
    paid: 0,
    remaining: 0,
  };
  if (!user.studentId) {
    return empty;
  }

  const doc = await getRequiredDocument();
  const student = doc.students.find((s) => s.id === user.studentId);
  if (!student) {
    return empty;
  }

  const classSection = student.classId ? doc.classes.find((c) => c.id === student.classId) : undefined;
  const payments = doc.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const warnings = doc.warnings
    .filter((w) => w.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const attendance = Object.entries(doc.attendance)
    .flatMap(([date, dayMap]) => {
      const status = dayMap[student.id];
      return status ? [{ date, status }] : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const timetable = (doc.timetable ?? [])
    .filter((t) => student.classId && t.classId === student.classId)
    .map((t) => ({ day: t.day, slot: t.slot, subjectId: t.subjectId }));

  const publishedTerms: Record<string, boolean> = {};
  if (student.classId) {
    for (const t of activeTerms(doc)) {
      publishedTerms[t.id] = doc.publishedResults?.[`${student.classId}::${t.id}`] === true;
    }
  }

  return {
    student: { ...student, placeOfBirth: student.placeOfBirth ?? "" },
    className: classSection?.nameAr ?? student.klass,
    terms: activeTerms(doc),
    subjects: doc.subjects.filter((s) => s.active),
    grades: doc.grades.filter((g) => g.studentId === student.id),
    payments: payments.map((p) => ({ id: p.id, amount: p.amount, date: p.date, note: p.note })),
    warnings: warnings.map((w) => ({ id: w.id, kind: w.kind, date: w.date, body: w.body })),
    attendance,
    timetable,
    publishedTerms,
    annualFee: student.annualFee,
    paid,
    remaining: Math.max(student.annualFee - paid, 0),
  };
}