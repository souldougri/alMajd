/**
 * Assessments & grades (Phase 2A). Every read/write is branch-scoped through
 * the class the assessment belongs to: a user must have branch access to the
 * class's branch before grading.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { getUserBranchScope, isAllScope, requireBranchAccess } from "./scope";
import { uid, writeAudit } from "./auth";
import type { SafeUser } from "@/lib/auth/types";

export type AssessmentTypeRow = { code: string; labelAr: string; labelFr: string; weight: number };

export type AssessmentRow = {
  id: string;
  classId: string;
  classNameAr: string;
  branchId: string;
  subjectId: string;
  subjectNameAr: string;
  termId: string;
  termNameAr: string;
  typeCode: string;
  title: string;
  date?: string;
  maxScore: number;
  createdAt: string;
};

export type GradeRow = {
  id: string;
  studentId: string;
  studentNameAr: string;
  assessmentId: string;
  score: number;
  note: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
};

function toAssessment(row: DbRow): AssessmentRow {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    classNameAr: row.class_name_ar ? String(row.class_name_ar) : "",
    branchId: String(row.branch_id),
    subjectId: String(row.subject_id),
    subjectNameAr: row.subject_name_ar ? String(row.subject_name_ar) : "",
    termId: String(row.term_id),
    termNameAr: row.term_name_ar ? String(row.term_name_ar) : "",
    typeCode: String(row.type_code),
    title: String(row.title),
    date: row.date ? String(row.date) : undefined,
    maxScore: Number(row.max_score ?? 20),
    createdAt: String(row.created_at),
  };
}

function toGrade(row: DbRow): GradeRow {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    studentNameAr: row.student_name_ar ? String(row.student_name_ar) : "",
    assessmentId: String(row.assessment_id),
    score: Number(row.score ?? 0),
    note: String(row.note ?? ""),
    recordedByName: row.recorded_by_name ? String(row.recorded_by_name) : "",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Resolves a class and enforces the actor's branch access, returning the branch. */
async function requireClassBranch(actor: SafeUser, classId: string): Promise<string> {
  const result = await (
    await getDb()
  ).query("SELECT id, branch_id FROM classes WHERE id = $1 LIMIT 1", [classId]);
  if (result.rows.length === 0) throw new ApiError("الصف غير موجود", 404);
  const branchId = String(result.rows[0].branch_id);
  await requireBranchAccess(actor, branchId);
  return branchId;
}

/**
 * Ensures the class is inside the actor's branch scope and returns its branch.
 */
async function assertClassInActorScope(actor: SafeUser, classId: string): Promise<string> {
  return requireClassBranch(actor, classId);
}

function hasAcademicAuthority(actor: SafeUser): boolean {
  return actor.role === "super_admin" || actor.duties.includes("academic");
}

export async function listAssessmentTypes(): Promise<AssessmentTypeRow[]> {
  const result = await (
    await getDb()
  ).query(
    "SELECT code, label_ar, label_fr, weight FROM assessment_types ORDER BY sort_order ASC",
  );
  return result.rows.map((r) => ({
    code: String(r.code),
    labelAr: String(r.label_ar),
    labelFr: String(r.label_fr),
    weight: Number(r.weight ?? 1),
  }));
}

export async function listAssessments(
  actor: SafeUser,
  opts?: { classId?: string; subjectId?: string; termId?: string },
): Promise<AssessmentRow[]> {
  const scope = await getUserBranchScope(actor);
  const params: unknown[] = [];
  let where = "";
  if (isAllScope(scope)) {
    where = "1=1";
  } else {
    params.push(scope);
    where = `a.class_id IN (SELECT id FROM classes WHERE branch_id = ANY($${params.length}::text[]))`;
  }
  if (opts?.classId) {
    params.push(opts.classId);
    where += ` AND a.class_id = $${params.length}`;
  }
  if (opts?.subjectId) {
    params.push(opts.subjectId);
    where += ` AND a.subject_id = $${params.length}`;
  }
  if (opts?.termId) {
    params.push(opts.termId);
    where += ` AND a.term_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT a.id, a.class_id, c.name_ar AS class_name_ar, c.branch_id, a.subject_id, s.name_ar AS subject_name_ar,
            a.term_id, t.name_ar AS term_name_ar, a.type_code, a.title, a.date, a.max_score, a.created_at
     FROM assessments a
     JOIN classes c ON c.id = a.class_id
     JOIN subjects s ON s.id = a.subject_id
     JOIN terms t ON t.id = a.term_id
     WHERE ${where}
     ORDER BY a.created_at DESC, a.id DESC`,
    params,
  );
  return result.rows.map(toAssessment);
}

export async function createAssessment(
  actor: SafeUser,
  input: {
    classId: string;
    subjectId: string;
    termId: string;
    typeCode: string;
    title: string;
    date?: string;
    maxScore?: number;
  },
): Promise<AssessmentRow> {
  if (!hasAcademicAuthority(actor)) {
    throw new ApiError("غير مصرح لك — إنشاء التقييمات يتطلب صلاحية الشؤون الدراسية", 403);
  }
  if (!input.classId || !input.subjectId || !input.termId || !input.typeCode || !input.title.trim()) {
    throw new ApiError("بيانات التقييم غير مكتملة");
  }
  const branchId = await assertClassInActorScope(actor, input.classId);

  const db = await getDb();
  const typeCheck = await db.query("SELECT 1 FROM assessment_types WHERE code = $1", [input.typeCode]);
  if (typeCheck.rows.length === 0) throw new ApiError("نوع التقييم غير صالح");
  const subjectCheck = await db.query(
    "SELECT 1 FROM class_subjects WHERE class_id = $1 AND subject_id = $2",
    [input.classId, input.subjectId],
  );
  if (subjectCheck.rows.length === 0) throw new ApiError("المادة غير مرتبطة بهذا الصف");

  const id = uid("as");
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, date, max_score, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (class_id, subject_id, term_id, type_code, title) DO NOTHING`,
    [id, input.classId, input.subjectId, input.termId, input.typeCode, input.title.trim(), input.date ?? null, input.maxScore ?? 20, actor.id, now],
  );
  const exists = await db.query("SELECT id FROM assessments WHERE class_id = $1 AND subject_id = $2 AND term_id = $3 AND type_code = $4 AND title = $5", [
    input.classId, input.subjectId, input.termId, input.typeCode, input.title.trim(),
  ]);
  if (exists.rows.length === 0) throw new ApiError("تقييم مكرر لنفس الصف والمادة والفصل");
  const persistedId = String(exists.rows[0].id);
  const useId = persistedId === id ? id : persistedId;

  await writeAudit({
    action: "grade.entry",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: useId,
    targetName: input.title.trim(),
    branchId,
    entityType: "assessment",
    detail: `تم إنشاء تقييم (${input.typeCode}) للصف ${input.classId}`,
  });

  const list = await listAssessments(actor, { classId: input.classId, subjectId: input.subjectId, termId: input.termId, });
  const found = list.find((a) => a.id === useId);
  if (!found) return list[0];
  return found;
}

export async function removeAssessment(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    `SELECT a.id, c.branch_id FROM assessments a JOIN classes c ON c.id = a.class_id WHERE a.id = $1`,
    [id],
  );
  if (row.rows.length === 0) throw new ApiError("التقييم غير موجود", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM assessments WHERE id = $1", [id]);
}

export async function listGrades(
  actor: SafeUser,
  opts?: { assessmentId?: string; studentId?: string },
): Promise<GradeRow[]> {
  if (opts?.assessmentId) {
    await requireClassFromAssessment(actor, opts.assessmentId);
  }
  const params: unknown[] = [];
  let where = "1=1";
  if (opts?.assessmentId) {
    params.push(opts.assessmentId);
    where += ` AND g.assessment_id = $${params.length}`;
  }
  if (opts?.studentId) {
    params.push(opts.studentId);
    where += ` AND g.student_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT g.id, g.student_id, st.name_ar AS student_name_ar, g.assessment_id, g.score, g.note,
            COALESCE(u.name_ar, '') AS recorded_by_name, g.created_at, g.updated_at
     FROM grades g
     JOIN students st ON st.id = g.student_id
     LEFT JOIN users u ON u.id = g.recorded_by_user_id
     WHERE ${where}
     ORDER BY st.name_ar ASC, g.id DESC`,
    params,
  );
  return result.rows.map(toGrade);
}

async function requireClassFromAssessment(actor: SafeUser, assessmentId: string): Promise<string> {
  const result = await (
    await getDb()
  ).query(
    `SELECT a.id, c.branch_id FROM assessments a JOIN classes c ON c.id = a.class_id WHERE a.id = $1`,
    [assessmentId],
  );
  if (result.rows.length === 0) throw new ApiError("التقييم غير موجود", 404);
  const branchId = String(result.rows[0].branch_id);
  await requireBranchAccess(actor, branchId);
  return branchId;
}

export async function upsertGrade(
  actor: SafeUser,
  input: { studentId: string; assessmentId: string; score: number; note?: string },
): Promise<GradeRow> {
  const db = await getDb();
  const branchId = await requireClassFromAssessment(actor, input.assessmentId);

  const assessment = await db.query(
    "SELECT a.id, a.class_id, a.subject_id, a.max_score, c.academic_year_id FROM assessments a JOIN classes c ON c.id = a.class_id WHERE a.id = $1",
    [input.assessmentId],
  );
  const classId = String(assessment.rows[0].class_id);
  const subjectId = String(assessment.rows[0].subject_id);
  const academicYearId = String(assessment.rows[0].academic_year_id);
  if (!hasAcademicAuthority(actor)) {
    if (actor.role !== "teacher") {
      throw new ApiError("غير مصرح لك — إدخال الدرجات يتطلب صلاحية دراسية أو تكليفاً تدريسياً", 403);
    }
    const assignment = await db.query(
      `SELECT 1 FROM teaching_assignments
       WHERE teacher_user_id = $1 AND class_id = $2 AND subject_id = $3 AND academic_year_id = $4`,
      [actor.id, classId, subjectId, academicYearId],
    );
    if (assignment.rows.length === 0) {
      throw new ApiError("هذه المادة ليست ضمن تكليفك التدريسي", 403);
    }
  }
  const maxScore = Number(assessment.rows[0].max_score ?? 20);
  if (Number.isNaN(input.score) || input.score < 0 || input.score > maxScore) {
    throw new ApiError(`العلامة يجب أن تكون بين 0 و ${maxScore}`);
  }
  const enrolled = await db.query(
    "SELECT 1 FROM student_class_enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'enrolled'",
    [input.studentId, classId],
  );
  if (enrolled.rows.length === 0) throw new ApiError("الطالب ليس مسجلاً في هذا الصف");

  const now = new Date().toISOString();
  const id = uid("gr");
  const inserted = await db.query(
    `INSERT INTO grades (id, student_id, assessment_id, score, note, recorded_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (student_id, assessment_id) DO UPDATE
       SET score = EXCLUDED.score, note = EXCLUDED.note, recorded_by_user_id = EXCLUDED.recorded_by_user_id, updated_at = EXCLUDED.updated_at
     RETURNING id`,
    [id, input.studentId, input.assessmentId, input.score, input.note ?? "", actor.id, now],
  );
  const gradeId = String(inserted.rows[0].id);

  await writeAudit({
    action: "grade.entry",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: gradeId,
    targetName: `علامة ${input.studentId}`,
    branchId,
    entityType: "grade",
    detail: `تسجيل علامة ${input.score} لتقييم ${input.assessmentId}`,
  });

  const list = await listGrades(actor, { studentId: input.studentId });
  return list.find((g) => g.id === gradeId) ?? (await getGradeById(gradeId, actor));
}

async function getGradeById(id: string, actor: SafeUser): Promise<GradeRow> {
  const list = await listGrades(actor);
  const found = list.find((g) => g.id === id);
  if (!found) throw new ApiError("العلامة غير موجودة", 404);
  return found;
}

export async function removeGrade(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    `SELECT g.id, c.branch_id FROM grades g
     JOIN assessments a ON a.id = g.assessment_id
     JOIN classes c ON c.id = a.class_id
     WHERE g.id = $1`,
    [id],
  );
  if (row.rows.length === 0) throw new ApiError("العلامة غير موجودة", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM grades WHERE id = $1", [id]);
}

/** Branches that can see a given assessment (used by step-12 scoping). */
export async function assessmentBranchId(assessmentId: string): Promise<string | null> {
  const result = await (
    await getDb()
  ).query(
    `SELECT c.branch_id FROM assessments a JOIN classes c ON c.id = a.class_id WHERE a.id = $1`,
    [assessmentId],
  );
  return result.rows[0] ? String(result.rows[0].branch_id) : null;
}
