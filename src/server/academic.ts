/**
 * Academic structure service (Phase 2A): academic years, terms, classes,
 * subjects (global catalog), class subjects, timetables, exam sessions and
 * published results. Classes are branch-scoped (branch carried on the class).
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { uid, writeAudit } from "./auth";
import { ApiError } from "./http";
import { getUserBranchScope, requireBranchAccess, requireBranchHeadOrAdmin, requireBranchId } from "./scope";
import type { SafeUser } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export type AcademicYearRow = {
  id: string;
  label: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  active: boolean;
  createdAt: string;
};

export type TermRow = {
  id: string;
  nameAr: string;
  nameFr: string;
  order: number;
  active: boolean;
};

export type ClassRow = {
  id: string;
  branchId: string;
  branchNameAr?: string;
  academicYearId: string;
  yearLabel?: string;
  nameAr: string;
  nameFr: string;
  level?: string | null;
  section?: string | null;
  capacity?: number | null;
  headTeacherUserId?: string | null;
  headTeacherNameAr?: string | null;
  active: boolean;
  createdAt: string;
};

export type SubjectRow = {
  id: string;
  code: string;
  nameAr: string;
  nameFr: string;
  active: boolean;
  createdAt: string;
};

export type ClassSubjectRow = {
  id: string;
  classId: string;
  subjectId: string;
  subjectCode?: string;
  subjectNameAr?: string;
  coefficient: number;
  maxScore: number;
  active: boolean;
};

export type TimetableEntryRow = {
  id: string;
  classId: string;
  day: number;
  slot: number;
  subjectId: string;
  subjectCode?: string;
};

export type ExamSessionRow = {
  id: string;
  termId: string;
  termNameAr?: string;
  branchId: string;
  branchNameAr?: string;
  name: string;
  date: string;
};

export type PublishedResultRow = {
  classId: string;
  termId: string;
  published: boolean;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function toAcademicYear(row: DbRow): AcademicYearRow {
  return {
    id: String(row.id),
    label: String(row.label),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    isCurrent: Boolean(row.is_current),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function toTerm(row: DbRow): TermRow {
  return {
    id: String(row.id),
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    order: Number(row.order ?? 0),
    active: Boolean(row.active),
  };
}

function toClass(row: DbRow): ClassRow {
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

function toSubject(row: DbRow): SubjectRow {
  return {
    id: String(row.id),
    code: String(row.code),
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function toClassSubject(row: DbRow): ClassSubjectRow {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    subjectId: String(row.subject_id),
    subjectCode: row.subject_code ? String(row.subject_code) : undefined,
    subjectNameAr: row.subject_name_ar ? String(row.subject_name_ar) : undefined,
    coefficient: Number(row.coefficient ?? 1),
    maxScore: Number(row.max_score ?? 20),
    active: Boolean(row.active),
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

function toExamSession(row: DbRow): ExamSessionRow {
  return {
    id: String(row.id),
    termId: String(row.term_id),
    termNameAr: row.term_name_ar ? String(row.term_name_ar) : undefined,
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : undefined,
    name: String(row.name),
    date: String(row.date),
  };
}

function toPublishedResult(row: DbRow): PublishedResultRow {
  return {
    classId: String(row.class_id),
    termId: String(row.term_id),
    published: Boolean(row.published),
    updatedAt: String(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

export async function listAcademicYears(): Promise<AcademicYearRow[]> {
  const result = await (
    await getDb()
  ).query(
    "SELECT id, label, start_date, end_date, is_current, active, created_at FROM academic_years ORDER BY created_at ASC",
  );
  return result.rows.map(toAcademicYear);
}

export async function getAcademicYear(id: string): Promise<AcademicYearRow> {
  const result = await (await getDb()).query(
    "SELECT id, label, start_date, end_date, is_current, active, created_at FROM academic_years WHERE id = $1 LIMIT 1",
    [id],
  );
  if (result.rows.length === 0) throw new ApiError("السنة الدراسية غير موجودة", 404);
  return toAcademicYear(result.rows[0]);
}

export async function createAcademicYear(
  input: { label: string; startDate?: string; endDate?: string; isCurrent?: boolean },
  actor: SafeUser,
): Promise<AcademicYearRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب صلاحية الشؤون الدراسية أو مدير النظام", 403);
  }
  const label = input.label.trim();
  if (!label) throw new ApiError("يرجى إدخال اسم السنة الدراسية");
  const db = await getDb();
  const clash = await db.query("SELECT id FROM academic_years WHERE label = $1", [label]);
  if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل سنة دراسية بهذا الاسم");
  const scl = await db.query("SELECT id FROM academic_years WHERE is_current = true LIMIT 1");
  const now = new Date().toISOString();
  const id = uid("ay");
  await db.query(
    `INSERT INTO academic_years (id, label, start_date, end_date, is_current, active, created_at)
     VALUES ($1, $2, $3, $4, $5, true, $6)`,
    [id, label, input.startDate ?? null, input.endDate ?? null, input.isCurrent ? true : scl.rows.length === 0, now],
  );
  if (input.isCurrent && scl.rows.length > 0) {
    await db.query("UPDATE academic_years SET is_current = false WHERE is_current = true");
    await db.query("UPDATE academic_years SET is_current = true WHERE id = $1", [id]);
  }
  await writeAudit({ action: "class.create", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: label, entityType: "academic_year", detail: "created academic year" });
  return toAcademicYear({ id, label, start_date: input.startDate, end_date: input.endDate, is_current: input.isCurrent ?? scl.rows.length === 0, active: true, created_at: now });
}

export async function updateAcademicYear(
  id: string,
  input: { label?: string; startDate?: string; endDate?: string; isCurrent?: boolean; active?: boolean },
  actor: SafeUser,
): Promise<AcademicYearRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك", 403);
  }
  const db = await getDb();
  const current = await getAcademicYear(id);
  const label = (input.label ?? "").trim() || current.label;
  if (label !== current.label) {
    const clash = await db.query("SELECT id FROM academic_years WHERE label = $1 AND id != $2", [label, id]);
    if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل سنة دراسية بهذا الاسم");
  }
  await db.query(
    "UPDATE academic_years SET label = $1, start_date = $2, end_date = $3, active = $4 WHERE id = $5",
    [label, input.startDate ?? current.startDate, input.endDate ?? current.endDate, input.active ?? current.active, id],
  );
  if (input.isCurrent !== undefined && input.isCurrent) {
    await db.query("UPDATE academic_years SET is_current = false WHERE is_current = true");
    await db.query("UPDATE academic_years SET is_current = true WHERE id = $1", [id]);
  }
  const fresh = await getAcademicYear(id);
  await writeAudit({ action: "class.update", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: fresh.label, entityType: "academic_year", detail: "updated academic year" });
  return fresh;
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export async function listTerms(): Promise<TermRow[]> {
  const result = await (
    await getDb()
  ).query("SELECT id, name_ar, name_fr, \"order\", active FROM terms ORDER BY \"order\" ASC");
  return result.rows.map(toTerm);
}

export async function createTerm(
  input: { id?: string; nameAr: string; nameFr?: string; order?: number; active?: boolean },
  actor: SafeUser,
): Promise<TermRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك — تعديل الفصول الدراسية يتطلب صلاحية الشؤون الدراسية أو مدير النظام", 403);
  }
  const nameAr = input.nameAr.trim();
  if (!nameAr) throw new ApiError("يرجى إدخال اسم الفصل الدراسي");
  const db = await getDb();
  const id = input.id?.trim() || uid("trm");
  await db.query(
    'INSERT INTO terms (id, name_ar, name_fr, "order", active) VALUES ($1, $2, $3, $4, $5)',
    [id, nameAr, input.nameFr?.trim() ?? "", Number.isFinite(input.order) ? Number(input.order) : 0, input.active ?? true],
  );
  await writeAudit({ action: "term.create", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: nameAr, entityType: "term", detail: "created term" });
  return { id, nameAr, nameFr: input.nameFr?.trim() ?? "", order: Number.isFinite(input.order) ? Number(input.order) : 0, active: input.active ?? true };
}

export async function updateTerm(
  id: string,
  input: { nameAr?: string; nameFr?: string; order?: number; active?: boolean },
  actor: SafeUser,
): Promise<TermRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك", 403);
  }
  const db = await getDb();
  const current = await db.query("SELECT id, name_ar, name_fr, \"order\", active FROM terms WHERE id = $1", [id]);
  if (current.rows.length === 0) throw new ApiError("الفصل الدراسي غير موجود", 404);
  const row = current.rows[0];
  const nameAr = (input.nameAr ?? "").trim() || String(row.name_ar);
  if (!nameAr) throw new ApiError("يرجى إدخال اسم الفصل الدراسي");
  const nameFr = input.nameFr !== undefined ? input.nameFr.trim() : String(row.name_fr ?? "");
  const order = input.order !== undefined && Number.isFinite(input.order) ? Number(input.order) : Number(row.order ?? 0);
  const active = input.active !== undefined ? input.active : Boolean(row.active);
  await db.query(
    'UPDATE terms SET name_ar = $1, name_fr = $2, "order" = $3, active = $4 WHERE id = $5',
    [nameAr, nameFr, order, active, id],
  );
  await writeAudit({ action: "term.update", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: nameAr, entityType: "term", detail: "updated term" });
  return { id, nameAr, nameFr, order, active };
}

export async function deleteTerm(id: string, actor: SafeUser): Promise<void> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك", 403);
  }
  const db = await getDb();
  const row = await db.query("SELECT id, name_ar FROM terms WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("الفصل الدراسي غير موجود", 404);
  await db.query("DELETE FROM terms WHERE id = $1", [id]);
  await writeAudit({ action: "term.delete", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: String(row.rows[0].name_ar), entityType: "term", detail: "deleted term" });
}

// ---------------------------------------------------------------------------
// Subjects (global catalog)
// ---------------------------------------------------------------------------

export async function listSubjects(): Promise<SubjectRow[]> {
  const result = await (
    await getDb()
  ).query("SELECT id, code, name_ar, name_fr, active, created_at FROM subjects ORDER BY name_ar ASC");
  return result.rows.map(toSubject);
}

export async function createSubject(
  input: { id?: string; code: string; nameAr: string; nameFr?: string },
  actor: SafeUser,
): Promise<SubjectRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك — إنشاء المواد يتطلب صلاحية الشؤون الدراسية أو مدير النظام", 403);
  }
  const code = input.code.trim().toUpperCase();
  const nameAr = input.nameAr.trim();
  if (!code || !nameAr) throw new ApiError("يرجى إدخال رمز المادة واسمها");
  const db = await getDb();
  const clash = await db.query("SELECT id FROM subjects WHERE code = $1", [code]);
  if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل مادة بهذا الرمز");
  const id = input.id?.trim() || uid("sub");
  await db.query(
    "INSERT INTO subjects (id, code, name_ar, name_fr, active, created_at) VALUES ($1, $2, $3, $4, true, $5)",
    [id, code, nameAr, input.nameFr?.trim() ?? "", new Date().toISOString()],
  );
  await writeAudit({ action: "subject.create", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: nameAr, entityType: "subject", detail: `created subject ${code}` });
  return { id, code, nameAr, nameFr: input.nameFr?.trim() ?? "", active: true, createdAt: new Date().toISOString() };
}

export async function updateSubject(
  id: string,
  input: { code?: string; nameAr?: string; nameFr?: string; active?: boolean },
  actor: SafeUser,
): Promise<SubjectRow> {
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    throw new ApiError("غير مصرح لك", 403);
  }
  const db = await getDb();
  const current = await db.query("SELECT * FROM subjects WHERE id = $1", [id]);
  if (current.rows.length === 0) throw new ApiError("المادة غير موجودة", 404);
  const row = current.rows[0];
  const code = (input.code ?? "").trim().toUpperCase() || String(row.code);
  const nameAr = (input.nameAr ?? "").trim() || String(row.name_ar);
  await db.query("UPDATE subjects SET code = $1, name_ar = $2, name_fr = $3, active = $4 WHERE id = $5", [
    code,
    nameAr,
    input.nameFr !== undefined ? input.nameFr.trim() : row.name_fr,
    input.active ?? Boolean(row.active),
    id,
  ]);
  await writeAudit({ action: "subject.update", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: nameAr, entityType: "subject", detail: "updated subject" });
  return toSubject({ id, code, name_ar: nameAr, name_fr: input.nameFr ?? row.name_fr, active: input.active ?? row.active, created_at: row.created_at });
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

const BASE_CLASS_SELECT = `
  SELECT c.id, c.branch_id, b.name_ar AS branch_name_ar, c.academic_year_id, ay.label AS year_label,
         c.name_ar, c.name_fr, c.level, c.section, c.capacity, c.head_teacher_user_id,
         hu.name_ar AS head_teacher_name_ar, c.active, c.created_at
  FROM classes c
  JOIN branches b ON b.id = c.branch_id
  JOIN academic_years ay ON ay.id = c.academic_year_id
  LEFT JOIN users hu ON hu.id = c.head_teacher_user_id`;

export async function listClasses(
  user: SafeUser,
  opts?: { branchId?: string; academicYearId?: string; includeInactive?: boolean },
): Promise<ClassRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.branchId) {
    await requireBranchAccess(user, opts.branchId);
    params.push(opts.branchId);
    where += ` AND c.branch_id = $${params.length}`;
  }
  if (opts?.academicYearId) {
    params.push(opts.academicYearId);
    where += ` AND c.academic_year_id = $${params.length}`;
  }
  if (!opts?.includeInactive) {
    params.push(true);
    where += ` AND c.active = $${params.length}`;
  }
  if (!opts?.branchId && user.role !== "super_admin") {
    const scope = await getUserBranchScope(user);
    params.push(scope);
    where += ` AND c.branch_id = ANY($${params.length})`;
  }
  const result = await (
    await getDb()
  ).query(`${BASE_CLASS_SELECT} WHERE 1=1${where} ORDER BY ay.start_date IS NULL, c.name_ar ASC`, params);
  return result.rows.map(toClass);
}

export async function getClass(id: string, user: SafeUser): Promise<ClassRow> {
  const db = await getDb();
  const result = await db.query(`${BASE_CLASS_SELECT} WHERE c.id = $1 LIMIT 1`, [id]);
  if (result.rows.length === 0) throw new ApiError("الفصل غير موجود", 404);
  const cls = toClass(result.rows[0]);
  await requireBranchAccess(user, cls.branchId);
  return cls;
}

async function requireClassNotFound(db: Awaited<ReturnType<typeof getDb>>, classId: string): Promise<ClassRow> {
  const result = await db.query(`${BASE_CLASS_SELECT} WHERE c.id = $1 LIMIT 1`, [classId]);
  if (result.rows.length === 0) throw new ApiError("الفصل غير موجود", 404);
  return toClass(result.rows[0]);
}

export async function createClass(
  input: { id?: string; branchId: string; academicYearId: string; nameAr: string; nameFr?: string; level?: string; section?: string; capacity?: number; headTeacherUserId?: string },
  actor: SafeUser,
): Promise<ClassRow> {
  const bid = requireBranchId(input.branchId);
  await requireBranchAccess(actor, bid);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic") && !actor.duties.includes("registrar")) {
    await requireBranchHeadOrAdmin(actor, bid);
  }
  const nameAr = input.nameAr.trim();
  if (!nameAr) throw new ApiError("يرجى إدخال اسم الفصل");
  const db = await getDb();
  const branch = await db.query("SELECT id FROM branches WHERE id = $1", [bid]);
  if (branch.rows.length === 0) throw new ApiError("الفرع غير موجود", 404);
  const year = await db.query("SELECT id FROM academic_years WHERE id = $1", [input.academicYearId]);
  if (year.rows.length === 0) throw new ApiError("السنة الدراسية غير موجودة", 404);
  const clash = await db.query(
    "SELECT id FROM classes WHERE branch_id = $1 AND academic_year_id = $2 AND name_ar = $3",
    [bid, input.academicYearId, nameAr],
  );
  if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل فصل بهذا الاسم في هذا الفرع والسنة");
  const id = input.id?.trim() || uid("cls");
  await db.query(
    `INSERT INTO classes (id, branch_id, academic_year_id, name_ar, name_fr, level, section, capacity, head_teacher_user_id, active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)`,
    [id, bid, input.academicYearId, nameAr, input.nameFr?.trim() ?? "", input.level ?? null, input.section ?? null, input.capacity ?? null, input.headTeacherUserId ?? null, new Date().toISOString()],
  );
  await writeAudit({ action: "class.create", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: nameAr, branchId: bid, entityType: "class", detail: `created class in branch ${bid}` });
  return requireClassNotFound(db, id);
}

export async function updateClass(
  classId: string,
  input: { nameAr?: string; nameFr?: string; level?: string; section?: string; capacity?: number; headTeacherUserId?: string; active?: boolean },
  actor: SafeUser,
): Promise<ClassRow> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(actor, cls.branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic") && !actor.duties.includes("registrar")) {
    await requireBranchHeadOrAdmin(actor, cls.branchId);
  }
  const nameAr = (input.nameAr ?? "").trim() || cls.nameAr;
  if (nameAr !== cls.nameAr) {
    const clash = await db.query(
      "SELECT id FROM classes WHERE branch_id = $1 AND academic_year_id = $2 AND name_ar = $3 AND id != $4",
      [cls.branchId, cls.academicYearId, nameAr, classId],
    );
    if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل فصل بهذا الاسم");
  }
  await db.query(
    `UPDATE classes SET name_ar = $1, name_fr = $2, level = $3, section = $4, capacity = $5,
            head_teacher_user_id = $6, active = $7 WHERE id = $8`,
    [
      nameAr,
      input.nameFr ?? cls.nameFr,
      input.level !== undefined ? (input.level === "" ? null : input.level) : cls.level ?? null,
      input.section !== undefined ? (input.section === "" ? null : input.section) : cls.section ?? null,
      input.capacity ?? cls.capacity ?? null,
      input.headTeacherUserId !== undefined ? (input.headTeacherUserId === "" ? null : input.headTeacherUserId) : cls.headTeacherUserId ?? null,
      input.active ?? cls.active,
      classId,
    ],
  );
  await writeAudit({ action: "class.update", actorId: actor.id, actorName: actor.nameAr, targetId: classId, targetName: nameAr, branchId: cls.branchId, entityType: "class", detail: "updated class" });
  return requireClassNotFound(db, classId);
}

/** Transfers a class to another branch (its enrollments/assignments follow). */
export async function transferClass(
  classId: string,
  toBranchId: string,
  actor: SafeUser,
): Promise<ClassRow> {
  requireBranchId(classId);
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(actor, cls.branchId);
  const toBid = requireBranchId(toBranchId);
  await requireBranchAccess(actor, toBid);
  if (cls.branchId === toBid) throw new ApiError("الفصل مسجل في هذا الفرع بالفعل");
  // Name uniqueness is per (branch, year) — moving may collide with the target branch.
  const clash = await db.query(
    "SELECT id FROM classes WHERE branch_id = $1 AND academic_year_id = $2 AND name_ar = $3",
    [toBid, cls.academicYearId, cls.nameAr],
  );
  if (clash.rows.length > 0) throw new ApiError("يوجد بالفعل فصل بهذا الاسم في الفرع الهدف");
  await db.query("UPDATE classes SET branch_id = $1 WHERE id = $2", [toBid, classId]);
  await writeAudit({ action: "class.transfer", actorId: actor.id, actorName: actor.nameAr, targetId: classId, targetName: cls.nameAr, branchId: toBid, entityType: "class", detail: `transferred class from ${cls.branchId} to ${toBid}` });
  return requireClassNotFound(db, classId);
}

// ---------------------------------------------------------------------------
// Class subjects
// ---------------------------------------------------------------------------

export async function listClassSubjects(classId: string, user: SafeUser): Promise<ClassSubjectRow[]> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(user, cls.branchId);
  const result = await db.query(
    `SELECT cs.id, cs.class_id, cs.subject_id, s.code AS subject_code, s.name_ar AS subject_name_ar,
            cs.coefficient, cs.max_score, cs.active
     FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.class_id = $1 ORDER BY s.name_ar ASC`,
    [classId],
  );
  return result.rows.map(toClassSubject);
}

/** Attaches a subject to a class with coefficient/max score (upsert). */
export async function setClassSubject(
  input: { classId: string; subjectId: string; coefficient?: number; maxScore?: number; active?: boolean },
  actor: SafeUser,
  remove = false,
): Promise<ClassSubjectRow | null> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, input.classId);
  await requireBranchAccess(actor, cls.branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, cls.branchId);
  }
  const subj = await db.query("SELECT id FROM subjects WHERE id = $1", [input.subjectId]);
  if (subj.rows.length === 0) throw new ApiError("المادة غير موجودة", 404);
  if (remove) {
    await db.query("DELETE FROM class_subjects WHERE class_id = $1 AND subject_id = $2", [input.classId, input.subjectId]);
    await writeAudit({ action: "subject.delete", actorId: actor.id, actorName: actor.nameAr, targetId: input.subjectId, targetName: String(subj.rows[0].id), branchId: cls.branchId, entityType: "class_subject", detail: "removed subject from class" });
    return null;
  }
  await db.query(
    `INSERT INTO class_subjects (id, class_id, subject_id, coefficient, max_score, active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (class_id, subject_id) DO UPDATE SET
       coefficient = EXCLUDED.coefficient, max_score = EXCLUDED.max_score, active = EXCLUDED.active`,
    [
      uid("csx"),
      input.classId,
      input.subjectId,
      input.coefficient ?? 1,
      input.maxScore ?? 20,
      input.active ?? true,
    ],
  );
  await writeAudit({ action: "subject.update", actorId: actor.id, actorName: actor.nameAr, targetId: input.subjectId, branchId: cls.branchId, entityType: "class_subject", detail: "attached subject to class" });
  const rows = await db.query(
    `SELECT cs.*, s.code AS subject_code, s.name_ar AS subject_name_ar FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.class_id = $1 AND cs.subject_id = $2`,
    [input.classId, input.subjectId],
  );
  return toClassSubject(rows.rows[0]);
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export async function listTimetable(classId: string, user: SafeUser): Promise<TimetableEntryRow[]> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(user, cls.branchId);
  const result = await db.query(
    `SELECT t.id, t.class_id, t.day, t.slot, t.subject_id, s.code AS subject_code
     FROM timetable_entries t JOIN subjects s ON s.id = t.subject_id
     WHERE t.class_id = $1 ORDER BY t.day ASC, t.slot ASC`,
    [classId],
  );
  return result.rows.map(toTimetableEntry);
}

export async function upsertTimetableEntry(
  input: { classId: string; day: number; slot: number; subjectId: string },
  actor: SafeUser,
): Promise<TimetableEntryRow> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, input.classId);
  await requireBranchAccess(actor, cls.branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, cls.branchId);
  }
  await db.query(
    `INSERT INTO timetable_entries (id, class_id, day, slot, subject_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (class_id, day, slot) DO UPDATE SET subject_id = EXCLUDED.subject_id`,
    [uid("tt"), input.classId, input.day, input.slot, input.subjectId],
  );
  const created = await db.query(
    `SELECT t.id, t.class_id, t.day, t.slot, t.subject_id, s.code AS subject_code
     FROM timetable_entries t JOIN subjects s ON s.id = t.subject_id
     WHERE t.class_id = $1 AND t.day = $2 AND t.slot = $3`,
    [input.classId, input.day, input.slot],
  );
  return toTimetableEntry(created.rows[0]);
}

export async function removeTimetableEntry(entryId: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    "SELECT id, class_id FROM timetable_entries WHERE id = $1",
    [entryId],
  );
  if (row.rows.length === 0) throw new ApiError("الحصة غير موجودة", 404);
  const cls = await requireClassNotFound(db, String(row.rows[0].class_id));
  await requireBranchAccess(actor, cls.branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, cls.branchId);
  }
  await db.query("DELETE FROM timetable_entries WHERE id = $1", [entryId]);
}

// ---------------------------------------------------------------------------
// Exam sessions
// ---------------------------------------------------------------------------

export async function listExamSessions(
  user: SafeUser,
  opts?: { branchId?: string; termId?: string },
): Promise<ExamSessionRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.branchId) {
    await requireBranchAccess(user, opts.branchId);
    params.push(opts.branchId);
    where += ` AND es.branch_id = $${params.length}`;
  }
  if (opts?.termId) {
    params.push(opts.termId);
    where += ` AND es.term_id = $${params.length}`;
  }
  if (!opts?.branchId && user.role !== "super_admin") {
    const scope = await getUserBranchScope(user);
    params.push(scope);
    where += ` AND es.branch_id = ANY($${params.length})`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT es.id, es.term_id, t.name_ar AS term_name_ar, es.branch_id, b.name_ar AS branch_name_ar, es.name, es.date
     FROM exam_sessions es
     JOIN terms t ON t.id = es.term_id
     JOIN branches b ON b.id = es.branch_id
     WHERE 1=1${where}
     ORDER BY es.date ASC`,
    params,
  );
  return result.rows.map(toExamSession);
}

export async function createExamSession(
  input: { id?: string; branchId: string; termId: string; name: string; date: string },
  actor: SafeUser,
): Promise<ExamSessionRow> {
  const bid = requireBranchId(input.branchId);
  await requireBranchAccess(actor, bid);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, bid);
  }
  const db = await getDb();
  const id = input.id?.trim() || uid("esx");
  await db.query(
    "INSERT INTO exam_sessions (id, term_id, branch_id, name, date) VALUES ($1, $2, $3, $4, $5)",
    [id, input.termId, bid, input.name, input.date],
  );
  await writeAudit({ action: "class.update", actorId: actor.id, actorName: actor.nameAr, targetId: id, targetName: input.name, branchId: bid, entityType: "exam_session", detail: "created exam session" });
  const rows = await db.query(
    `SELECT es.id, es.term_id, t.name_ar AS term_name_ar, es.branch_id, b.name_ar AS branch_name_ar, es.name, es.date
     FROM exam_sessions es JOIN terms t ON t.id = es.term_id JOIN branches b ON b.id = es.branch_id
     WHERE es.id = $1`,
    [id],
  );
  return toExamSession(rows.rows[0]);
}

export async function deleteExamSession(sessionId: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id FROM exam_sessions WHERE id = $1", [sessionId]);
  if (row.rows.length === 0) throw new ApiError("الجلسة غير موجودة", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, String(row.rows[0].branch_id));
  }
  await db.query("DELETE FROM exam_sessions WHERE id = $1", [sessionId]);
}

// ---------------------------------------------------------------------------
// Published results (bulletin publishing)
// ---------------------------------------------------------------------------

export async function getPublishedResults(
  classId: string,
  user: SafeUser,
): Promise<PublishedResultRow[]> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(user, cls.branchId);
  const result = await db.query(
    "SELECT class_id, term_id, published, updated_at FROM published_results WHERE class_id = $1 ORDER BY term_id",
    [classId],
  );
  return result.rows.map(toPublishedResult);
}

export async function setPublishedResults(
  classId: string,
  termId: string,
  published: boolean,
  actor: SafeUser,
): Promise<PublishedResultRow> {
  const db = await getDb();
  const cls = await requireClassNotFound(db, classId);
  await requireBranchAccess(actor, cls.branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("academic")) {
    await requireBranchHeadOrAdmin(actor, cls.branchId);
  }
  await db.query(
    `INSERT INTO published_results (class_id, term_id, published, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (class_id, term_id) DO UPDATE SET published = EXCLUDED.published, updated_at = EXCLUDED.updated_at`,
    [classId, termId, published, new Date().toISOString()],
  );
  await writeAudit({ action: "bulletin.publish", actorId: actor.id, actorName: actor.nameAr, targetId: classId, branchId: cls.branchId, entityType: "published_result", detail: `${published ? "published" : "unpublished"} bulletin for term ${termId}` });
  const rows = await db.query(
    "SELECT class_id, term_id, published, updated_at FROM published_results WHERE class_id = $1 AND term_id = $2",
    [classId, termId],
  );
  return toPublishedResult(rows.rows[0]);
}
