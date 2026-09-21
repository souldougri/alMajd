/**
 * Teacher Portal (Phase 2A relational implementation).
 *
 * Replaces the legacy `server/school.ts` document-based teacher portal.
 * Uses teaching_assignments, teacher_branch_assignments, class_subjects,
 * assessments, and grades tables. All access is branch-scoped and
 * teacher-authorized server-side.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { uid, writeAudit } from "./auth";
import { ApiError } from "./http";
import { getUserBranchScope, hasBranchAccess, isAllScope, requireBranchAccess } from "./scope";
import { listTeachingAssignments, type TeachingAssignmentRow } from "./assignments";
import { listAssessments, listGrades, upsertGrade } from "./grades";
import { listTerms } from "./academic";
import type { SafeUser } from "@/lib/auth/types";
import type { ClassRow, SubjectRow, ClassSubjectRow, TimetableEntryRow } from "./academic";
import type { StudentRow } from "./students";

// ---------------------------------------------------------------------------
// Types matching the client TeacherPortfolio (lib/teacher.ts)
// ---------------------------------------------------------------------------

export type TeacherClass = {
  id: string;
  nameAr: string;
  nameFr?: string;
  level?: string;
  section?: string;
  capacity?: number;
  teacherStaffId?: string;
  isHeadOfClass: boolean;
  timetable: TimetableEntryRow[];
  students: StudentRow[];
  subjects: (SubjectRow & { coefficient: number; maxScore: number })[];
  grades: Array<{ id: string; studentId: string; subjectId: string; termId: string; score: number; maxScore: number; date?: string; note?: string }>;
};

export type TeacherPortfolio = {
  staffId: string | null;
  staffName?: string;
  terms: Array<{ id: string; nameAr: string; nameFr: string; order: number; active: boolean }>;
  classes: TeacherClass[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTeacherClass(row: DbRow): ClassRow {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : undefined,
    academicYearId: String(row.academic_year_id),
    yearLabel: row.year_label ? String(row.year_label) : undefined,
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    level: row.level ? String(row.level) : null,
    section: row.section ? String(row.section) : null,
    capacity: row.capacity !== null && row.capacity !== undefined ? Number(row.capacity) : null,
    headTeacherUserId: row.head_teacher_user_id ? String(row.head_teacher_user_id) : null,
    headTeacherNameAr: row.head_teacher_name_ar ? String(row.head_teacher_name_ar) : null,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function toTeacherSubject(row: DbRow): SubjectRow & { coefficient: number; maxScore: number } {
  return {
    id: String(row.id),
    code: String(row.code),
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    coefficient: Number(row.coefficient ?? 1),
    maxScore: Number(row.max_score ?? 20),
  };
}

function toTimetableEntry(row: DbRow): TimetableEntryRow {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    day: Number(row.day),
    slot: Number(row.slot),
    subjectId: String(row.subject_id),
    subjectCode: row.subject_code ? String(row.subject_code) : undefined,
  };
}

function toStudentRow(row: DbRow): StudentRow {
  return {
    id: String(row.id),
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    gender: String(row.gender ?? "male"),
    klass: String(row.klass ?? ""),
    dob: String(row.dob ?? ""),
    placeOfBirth: String(row.place_of_birth ?? ""),
    parentAr: String(row.parent_ar ?? ""),
    phone: String(row.phone ?? ""),
    enrolled: String(row.enrolled ?? ""),
    annualFee: Number(row.annual_fee ?? 0),
    photo: row.photo ? String(row.photo) : undefined,
    email: String(row.email ?? ""),
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : undefined,
    classId: row.class_id ? String(row.class_id) : undefined,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Gets all branch IDs the teacher is assigned to (from teacher_branch_assignments).
 * Respects the caller's branch scope (super_admin sees all; others see intersection).
 */
async function getTeacherBranchIds(teacherUserId: string, caller: SafeUser): Promise<string[]> {
  const db = await getDb();
  const rows = await db.query(
    "SELECT branch_id FROM teacher_branch_assignments WHERE teacher_user_id = $1 ORDER BY assigned_at ASC",
    [teacherUserId],
  );
  const allBranchIds = rows.rows.map((r) => String(r.branch_id));
  const scope = await getUserBranchScope(caller);
  if (isAllScope(scope)) return allBranchIds;
  return allBranchIds.filter((id) => hasBranchAccess(scope, id));
}

/**
 * Gets all teaching assignments for the teacher, filtered by branch scope.
 * Returns enriched assignments with class, subject, and branch info.
 */
async function getTeacherTeachingAssignments(teacherUserId: string, caller: SafeUser): Promise<TeachingAssignmentRow[]> {
  const visible = await listTeachingAssignments(caller, { teacherUserId });
  const scope = await getUserBranchScope(caller);
  if (isAllScope(scope)) return visible;
  return visible.filter((ta) => ta.branchId === undefined || hasBranchAccess(scope, ta.branchId));
}

/**
 * Gets the current academic year ID (the one with is_current = true).
 */
async function getCurrentAcademicYearId(): Promise<string | null> {
  const db = await getDb();
  const result = await db.query("SELECT id FROM academic_years WHERE is_current = true LIMIT 1");
  return result.rows[0] ? String(result.rows[0].id) : null;
}

/**
 * Determines if the teacher is the head teacher of a class.
 */
function isHeadTeacher(classRow: ClassRow, teacherUserId: string): boolean {
  return classRow.headTeacherUserId === teacherUserId;
}

// ---------------------------------------------------------------------------
// getTeacherPortfolio (relational)
// ---------------------------------------------------------------------------

export async function getTeacherPortfolioRelational(user: SafeUser): Promise<TeacherPortfolio> {
  if (user.role !== "teacher") {
    return { staffId: null, staffName: undefined, terms: [], classes: [] };
  }

  const teacherUserId = user.id;
  const db = await getDb();

  // 1. Get teacher's branch memberships (scope-filtered)
  const branchIds = await getTeacherBranchIds(teacherUserId, user);
  if (branchIds.length === 0) {
    return { staffId: user.id, staffName: user.nameAr, terms: [], classes: [] };
  }

  // 2. Get teacher's teaching assignments (scope-filtered)
  const teachingAssignments = await getTeacherTeachingAssignments(teacherUserId, user);
  if (teachingAssignments.length === 0) {
    const terms = await listTerms();
    return { staffId: user.id, staffName: user.nameAr, terms, classes: [] };
  }

  // 3. Collect unique class IDs from teaching assignments
  const classIds = [...new Set(teachingAssignments.map((ta) => ta.classId))];

  // 4. Get current academic year for term filtering
  const currentAcademicYearId = await getCurrentAcademicYearId();

  // 5. Get active terms
  const terms = await listTerms();

  // 6. Get classes the teacher teaches (head teacher OR has teaching assignment)
  // We need to also include classes where teacher is head_teacher_user_id but may not have teaching_assignments
  // NOTE: array parameter (see grades query below) — a single-element
  // `IN ($1)` leaves Postgres unable to infer the type (42P18).
  const classesResult = await db.query(
    `SELECT c.id, c.branch_id, b.name_ar AS branch_name_ar, c.academic_year_id, ay.label AS year_label,
            c.name_ar, c.name_fr, c.level, c.section, c.capacity, c.head_teacher_user_id,
            hu.name_ar AS head_teacher_name_ar, c.active, c.created_at
     FROM classes c
     JOIN branches b ON b.id = c.branch_id
     JOIN academic_years ay ON ay.id = c.academic_year_id
     LEFT JOIN users hu ON hu.id = c.head_teacher_user_id
     WHERE c.id = ANY($1::text[]) AND c.active = true
     ORDER BY c.name_ar ASC`,
    [classIds],
  );
  const classes = classesResult.rows.map(toTeacherClass);

  // 7. Get teacher's subject assignments per class
  // Map: classId -> Set of subjectIds the teacher teaches
  const teacherSubjectsByClass = new Map<string, Set<string>>();
  for (const ta of teachingAssignments) {
    const set = teacherSubjectsByClass.get(ta.classId) ?? new Set();
    set.add(ta.subjectId);
    teacherSubjectsByClass.set(ta.classId, set);
  }

  // 8. For each class, get students, subjects, grades, timetable
  const teacherClasses: TeacherClass[] = [];

  for (const cls of classes) {
    const teacherSubjectIds = teacherSubjectsByClass.get(cls.id) ?? new Set();

    // Get students enrolled in this class (current academic year)
    const studentsResult = await db.query(
      `SELECT s.id, s.name_ar, s.name_fr, s.gender, s.klass, s.dob, s.place_of_birth,
              s.parent_ar, s.phone, s.enrolled, s.annual_fee, s.photo, s.email,
              s.branch_id, b.name_ar AS branch_name_ar, s.active, s.created_at, s.updated_at
       FROM students s
       JOIN branches b ON b.id = s.branch_id
       JOIN student_class_enrollments e ON e.student_id = s.id AND e.class_id = $1 AND e.is_current = true AND e.status = 'enrolled'
       WHERE s.active = true
       ORDER BY s.name_ar ASC`,
      [cls.id],
    );
    const students = studentsResult.rows.map(toStudentRow);

    // Get class subjects (from class_subjects) that this teacher teaches
    const subjectsResult = await db.query(
      `SELECT s.id, s.code, s.name_ar, s.name_fr, s.active, s.created_at,
              cs.coefficient, cs.max_score
       FROM class_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
       WHERE cs.class_id = $1 AND cs.active = true AND s.active = true
       ORDER BY s.name_ar ASC`,
      [cls.id],
    );
    const allClassSubjects = subjectsResult.rows.map(toTeacherSubject);

    // Filter to only subjects this teacher teaches (or all if head teacher)
    const isHead = isHeadTeacher(cls, teacherUserId);
    const subjects = isHead
      ? allClassSubjects
      : allClassSubjects.filter((s) => teacherSubjectIds.has(s.id));

    // Get timetable entries for this class, filtered to teacher's subjects
    const timetableResult = await db.query(
      `SELECT t.id, t.class_id, t.day, t.slot, t.subject_id, s.code AS subject_code
       FROM timetable_entries t
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.class_id = $1
       ORDER BY t.day ASC, t.slot ASC`,
      [cls.id],
    );
    const allTimetable = timetableResult.rows.map(toTimetableEntry);
    const timetable = isHead
      ? allTimetable
      : allTimetable.filter((t) => teacherSubjectIds.has(t.subjectId));

    // Grades for this teacher's subjects in this class, in one joined query.
    // NOTE: array parameters (`= ANY($n::text[])`) are used instead of a
    // hand-rolled `IN ($n, ...)` list: a single-element `IN ($n)` leaves
    // Postgres unable to infer the parameter type (42P18), which 500'd every
    // teacher portfolio.
    const subjectIds = subjects.map((s) => s.id);
    let grades: Array<{ id: string; studentId: string; subjectId: string; termId: string; score: number; maxScore: number; date?: string; note?: string }> = [];

    if (subjectIds.length > 0 && students.length > 0) {
      const gradesResult = await db.query(
        `SELECT g.id, g.student_id, a.subject_id, a.term_id, g.score, a.max_score, a.date, g.note
         FROM grades g
         JOIN assessments a ON a.id = g.assessment_id
         WHERE a.class_id = $1 AND a.subject_id = ANY($2::text[]) AND g.student_id = ANY($3::text[])
         ORDER BY a.term_id ASC, a.subject_id ASC`,
        [cls.id, subjectIds, students.map((s) => s.id)],
      );
      grades = gradesResult.rows.map((r) => ({
        id: String(r.id),
        studentId: String(r.student_id),
        subjectId: String(r.subject_id),
        termId: String(r.term_id),
        score: Number(r.score),
        maxScore: Number(r.max_score ?? 20),
        date: r.date ? String(r.date) : undefined,
        note: r.note ? String(r.note) : undefined,
      }));
    }

    teacherClasses.push({
      id: cls.id,
      nameAr: cls.nameAr,
      nameFr: cls.nameFr,
      level: cls.level ?? undefined,
      section: cls.section ?? undefined,
      capacity: cls.capacity ?? undefined,
      teacherStaffId: cls.headTeacherUserId ?? undefined,
      isHeadOfClass: isHead,
      timetable,
      students,
      subjects,
      grades,
    });
  }

  return { staffId: user.id, staffName: user.nameAr, terms, classes: teacherClasses };
}

// ---------------------------------------------------------------------------
// upsertTeacherGrade (relational)
// ---------------------------------------------------------------------------

export type UpsertTeacherGradeResult = {
  saved: boolean;
  studentGrades: Array<{ id: string; studentId: string; subjectId: string; termId: string; score: number; maxScore: number; date?: string; note?: string }>;
};

export async function upsertTeacherGradeRelational(
  user: SafeUser,
  body: { studentId?: unknown; subjectId?: unknown; termId?: unknown; score?: unknown },
): Promise<UpsertTeacherGradeResult> {
  if (user.role !== "teacher") {
    throw new ApiError("حساب الأستاذ غير صالح. تواصل مع مدير النظام.", 403);
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const termId = typeof body.termId === "string" ? body.termId : "";

  if (!studentId || !subjectId || !termId) {
    throw new ApiError("بيانات غير مكتملة: studentId، subjectId، termId مطلوبة");
  }

  const db = await getDb();
  const teacherUserId = user.id;

  // 1. Verify teacher is assigned to this subject in this class for this term
  // Find the class for this subject+term that the teacher teaches
  const currentAcademicYearId = await getCurrentAcademicYearId();
  if (!currentAcademicYearId) {
    throw new ApiError("لا توجد سنة دراسية حالية محددة");
  }

  // Find teaching assignment for this teacher, subject, and academic year
  const taResult = await db.query(
    `SELECT ta.id, ta.class_id, c.branch_id
     FROM teaching_assignments ta
     JOIN classes c ON c.id = ta.class_id
     WHERE ta.teacher_user_id = $1 AND ta.subject_id = $2 AND ta.academic_year_id = $3`,
    [teacherUserId, subjectId, currentAcademicYearId],
  );

  if (taResult.rows.length === 0) {
    throw new ApiError("هذه المادة غير موكلة إليك في السنة الدراسية الحالية");
  }

  const classId = String(taResult.rows[0].class_id);
  const branchId = String(taResult.rows[0].branch_id);

  // 2. Enforce branch access
  await requireBranchAccess(user, branchId);

  // 3. Verify student is enrolled in this class
  const enrollmentResult = await db.query(
    `SELECT 1 FROM student_class_enrollments
     WHERE student_id = $1 AND class_id = $2 AND is_current = true AND status = 'enrolled'`,
    [studentId, classId],
  );
  if (enrollmentResult.rows.length === 0) {
    throw new ApiError("الطالب غير مسجل في هذا الفصل");
  }

  // 4. Verify term is active
  const termResult = await db.query("SELECT id, active FROM terms WHERE id = $1", [termId]);
  if (termResult.rows.length === 0 || !termResult.rows[0].active) {
    throw new ApiError("الفصل الدراسي غير موجود أو غير نشط");
  }

  // 5. Verify subject is active and attached to this class
  const classSubjectResult = await db.query(
    `SELECT cs.max_score FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.class_id = $1 AND cs.subject_id = $2 AND cs.active = true AND s.active = true`,
    [classId, subjectId],
  );
  if (classSubjectResult.rows.length === 0) {
    throw new ApiError("المادة غير مرتبطة بهذا الفصل أو غير نشطة");
  }
  const maxScore = Number(classSubjectResult.rows[0].max_score ?? 20);

  // 6. Find or create assessment for this class/subject/term
  // We need an assessment to attach the grade to. Use type 'quiz' as default for teacher entry.
  const assessmentResult = await db.query(
    `SELECT id, max_score FROM assessments
     WHERE class_id = $1 AND subject_id = $2 AND term_id = $3 AND type_code = 'quiz'
     ORDER BY created_at ASC LIMIT 1`,
    [classId, subjectId, termId],
  );

  let assessmentId: string;
  let assessmentMaxScore = maxScore;

  if (assessmentResult.rows.length > 0) {
    assessmentId = String(assessmentResult.rows[0].id);
    assessmentMaxScore = Number(assessmentResult.rows[0].max_score ?? maxScore);
  } else {
    // Create a default assessment for teacher grade entry
    assessmentId = uid("as");
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, max_score, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, 'quiz', 'درجة الأستاذ', $5, $6, $7)`,
      [assessmentId, classId, subjectId, termId, assessmentMaxScore, teacherUserId, now],
    );
    await writeAudit({
      action: "grade.entry",
      actorId: teacherUserId,
      actorName: user.nameAr,
      targetId: assessmentId,
      targetName: `تقييم افتراضي للمادة ${subjectId}`,
      branchId,
      entityType: "assessment",
      detail: `تم إنشاء تقييم افتراضي لإدخال درجات الأستاذ`,
    });
  }

  // 7. Validate score
  if (body.score !== null && body.score !== undefined && body.score !== "") {
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > assessmentMaxScore) {
      throw new ApiError(`الدرجة يجب أن تكون رقماً بين 0 و ${assessmentMaxScore}`);
    }
  }

  // 8. Upsert grade
  const gradeResult = await upsertGrade(user, {
    studentId,
    assessmentId,
    score: body.score !== null && body.score !== undefined && body.score !== "" ? Number(body.score) : 0,
    note: "",
  });

  // 9. Return student's grades for this subject/term
  const studentGradesResult = await db.query(
    `SELECT g.id, g.student_id, a.subject_id, a.term_id, g.score, a.max_score, a.date, g.note
     FROM grades g
     JOIN assessments a ON a.id = g.assessment_id
     WHERE g.student_id = $1 AND a.subject_id = $2 AND a.term_id = $3 AND a.class_id = $4`,
    [studentId, subjectId, termId, classId],
  );

  const studentGrades = studentGradesResult.rows.map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    subjectId: String(r.subject_id),
    termId: String(r.term_id),
    score: Number(r.score),
    maxScore: Number(r.max_score ?? 20),
    date: r.date ? String(r.date) : undefined,
    note: r.note ? String(r.note) : undefined,
  }));

  return { saved: true, studentGrades };
}