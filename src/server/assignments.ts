/**
 * Assignments service (Phase 2A): branch responsibilities, teaching
 * assignments, and employee/teacher branch membership.
 *
 * Tables served:
 *   - user_branch_assignments   (employee single-branch membership)
 *   - branch_responsibilities   (duty delegation per branch)
 *   - teacher_branch_assignments (teacher multi-branch membership)
 *   - teaching_assignments      (teacher → class+subject per academic year)
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { uid, writeAudit } from "./auth";
import { ApiError } from "./http";
import { requireBranchAccess, requireBranchId } from "./scope";
import type { SafeUser } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export type UserBranchRow = {
  id: string;
  userId: string;
  branchId: string;
  assignedAt: string;
  // enriched (branch-scoped readers such as the Branch Head cannot list users)
  userNameAr?: string;
};

export type BranchResponsibilityRow = {
  id: string;
  userId: string;
  branchId: string;
  dutyCode: string;
  assignedAt: string;
  // enriched (see UserBranchRow)
  userNameAr?: string;
};

export type TeacherBranchRow = {
  id: string;
  teacherUserId: string;
  branchId: string;
  assignedAt: string;
  // enriched (see UserBranchRow)
  userNameAr?: string;
};

export type TeachingAssignmentRow = {
  id: string;
  teacherUserId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  assignedAt: string;
  // enriched
  teacherNameAr?: string;
  classNameAr?: string;
  subjectCode?: string;
  yearLabel?: string;
  branchId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toUserBranch(row: DbRow): UserBranchRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    branchId: String(row.branch_id),
    assignedAt: String(row.assigned_at),
    userNameAr: row.user_name_ar ? String(row.user_name_ar) : undefined,
  };
}

function toBranchResponsibility(row: DbRow): BranchResponsibilityRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    branchId: String(row.branch_id),
    dutyCode: String(row.duty_code),
    assignedAt: String(row.assigned_at),
    userNameAr: row.user_name_ar ? String(row.user_name_ar) : undefined,
  };
}

function toTeacherBranch(row: DbRow): TeacherBranchRow {
  return {
    id: String(row.id),
    teacherUserId: String(row.teacher_user_id),
    branchId: String(row.branch_id),
    assignedAt: String(row.assigned_at),
    userNameAr: row.user_name_ar ? String(row.user_name_ar) : undefined,
  };
}

function toTeachingAssignment(row: DbRow): TeachingAssignmentRow {
  return {
    id: String(row.id),
    teacherUserId: String(row.teacher_user_id),
    classId: String(row.class_id),
    subjectId: String(row.subject_id),
    academicYearId: String(row.academic_year_id),
    assignedAt: String(row.assigned_at),
    teacherNameAr: row.teacher_name_ar ? String(row.teacher_name_ar) : undefined,
    classNameAr: row.class_name_ar ? String(row.class_name_ar) : undefined,
    subjectCode: row.subject_code ? String(row.subject_code) : undefined,
    yearLabel: row.year_label ? String(row.year_label) : undefined,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
  };
}

// ---------------------------------------------------------------------------
// user_branch_assignments (employee branch membership)
// ---------------------------------------------------------------------------

/** Lists all branch memberships. Admin sees all; others see memberships in their scope. */
export async function listUserBranchAssignments(
  user: SafeUser,
  opts?: { userId?: string; branchId?: string },
): Promise<UserBranchRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.userId) {
    params.push(opts.userId);
    where += ` AND uba.user_id = $${params.length}`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND uba.branch_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT uba.id, uba.user_id, uba.branch_id, uba.assigned_at,
            u.name_ar AS user_name_ar
     FROM user_branch_assignments uba
     JOIN users u ON u.id = uba.user_id
     WHERE 1=1${where}
     ORDER BY uba.assigned_at DESC`,
    params,
  );
  return result.rows.map(toUserBranch);
}

/** Assigns a user to a branch. Scope-checked on the target branch. */
export async function assignUserToBranch(
  branchId: string,
  userId: string,
  actor: SafeUser,
): Promise<UserBranchRow> {
  const bid = requireBranchId(branchId);
  const uid_ = requireBranchId(userId);
  await requireBranchAccess(actor, bid);
  const db = await getDb();
  // Verify user exists
  const userRow = await db.query("SELECT id, name_ar FROM users WHERE id = $1", [uid_]);
  if (userRow.rows.length === 0) throw new ApiError("الحساب غير موجود", 404);
  // Verify branch exists
  const branchRow = await db.query("SELECT id FROM branches WHERE id = $1", [bid]);
  if (branchRow.rows.length === 0) throw new ApiError("الفرع غير موجود", 404);
  // Check existing
  const existing = await db.query(
    "SELECT id FROM user_branch_assignments WHERE user_id = $1 AND branch_id = $2",
    [uid_, bid],
  );
  if (existing.rows.length > 0) {
    throw new ApiError("هذا الموظف معين بالفعل لهذا الفرع");
  }
  const now = new Date().toISOString();
  const id = uid("uba");
  await db.query(
    `INSERT INTO user_branch_assignments (id, user_id, branch_id, assigned_by_user_id, assigned_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, uid_, bid, actor.id, now],
  );
  return { id, userId: uid_, branchId: bid, assignedAt: now };
}

/** Removes a user from a branch. */
export async function removeUserFromBranch(
  branchId: string,
  userId: string,
  actor: SafeUser,
): Promise<void> {
  const bid = requireBranchId(branchId);
  const uid_ = requireBranchId(userId);
  await requireBranchAccess(actor, bid);
  const db = await getDb();
  await db.query("DELETE FROM user_branch_assignments WHERE user_id = $1 AND branch_id = $2", [uid_, bid]);
}

// ---------------------------------------------------------------------------
// branch_responsibilities
// ---------------------------------------------------------------------------

/** Lists branch responsibilities, optionally filtered. */
export async function listBranchResponsibilities(
  user: SafeUser,
  opts?: { branchId?: string; userId?: string; dutyCode?: string },
): Promise<BranchResponsibilityRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND br.branch_id = $${params.length}`;
  }
  if (opts?.userId) {
    params.push(opts.userId);
    where += ` AND br.user_id = $${params.length}`;
  }
  if (opts?.dutyCode) {
    params.push(opts.dutyCode);
    where += ` AND br.duty_code = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT br.id, br.user_id, br.branch_id, br.duty_code, br.assigned_at,
            u.name_ar AS user_name_ar
     FROM branch_responsibilities br
     JOIN users u ON u.id = br.user_id
     WHERE 1=1${where}
     ORDER BY br.assigned_at DESC`,
    params,
  );
  return result.rows.map(toBranchResponsibility);
}

/** Assigns a duty responsibility to a user in a branch. */
export async function assignBranchResponsibility(
  branchId: string,
  userId: string,
  dutyCode: string,
  actor: SafeUser,
): Promise<BranchResponsibilityRow> {
  const bid = requireBranchId(branchId);
  const uid_ = requireBranchId(userId);
  await requireBranchAccess(actor, bid);
  if (!dutyCode || typeof dutyCode !== "string") {
    throw new ApiError("رمز المهمة مفقود", 400);
  }
  const db = await getDb();
  // Verify duty exists
  const duty = await db.query("SELECT code FROM duties WHERE code = $1", [dutyCode]);
  if (duty.rows.length === 0) throw new ApiError("رمز المهمة غير صالح", 400);
  // Check duplicate
  const existing = await db.query(
    "SELECT id FROM branch_responsibilities WHERE user_id = $1 AND branch_id = $2 AND duty_code = $3",
    [uid_, bid, dutyCode],
  );
  if (existing.rows.length > 0) {
    throw new ApiError("هذا الموظف مسؤول بالفعل عن هذه المهمة في هذا الفرع");
  }
  const now = new Date().toISOString();
  const id = uid("brs");
  await db.query(
    `INSERT INTO branch_responsibilities (id, user_id, branch_id, duty_code, assigned_by_user_id, assigned_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, uid_, bid, dutyCode, actor.id, now],
  );
  return { id, userId: uid_, branchId: bid, dutyCode, assignedAt: now };
}

/** Removes a duty responsibility. */
export async function removeBranchResponsibility(
  responsibilityId: string,
  actor: SafeUser,
): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    "SELECT id, branch_id FROM branch_responsibilities WHERE id = $1",
    [responsibilityId],
  );
  if (row.rows.length === 0) throw new ApiError("المسؤولية غير موجودة", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM branch_responsibilities WHERE id = $1", [responsibilityId]);
}

// ---------------------------------------------------------------------------
// teacher_branch_assignments (multi-branch teacher membership)
// ---------------------------------------------------------------------------

/** Lists teacher branch memberships. */
export async function listTeacherBranchAssignments(
  user: SafeUser,
  opts?: { teacherUserId?: string; branchId?: string },
): Promise<TeacherBranchRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.teacherUserId) {
    params.push(opts.teacherUserId);
    where += ` AND tba.teacher_user_id = $${params.length}`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND tba.branch_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT tba.id, tba.teacher_user_id, tba.branch_id, tba.assigned_at,
            u.name_ar AS user_name_ar
     FROM teacher_branch_assignments tba
     JOIN users u ON u.id = tba.teacher_user_id
     WHERE 1=1${where}
     ORDER BY tba.assigned_at DESC`,
    params,
  );
  return result.rows.map(toTeacherBranch);
}

/** Assigns a teacher to a branch. Scope-checked. */
export async function assignTeacherToBranch(
  branchId: string,
  teacherUserId: string,
  actor: SafeUser,
): Promise<TeacherBranchRow> {
  const bid = requireBranchId(branchId);
  const tid = requireBranchId(teacherUserId);
  await requireBranchAccess(actor, bid);
  const db = await getDb();
  const teacher = await db.query("SELECT id, role FROM users WHERE id = $1", [tid]);
  if (teacher.rows.length === 0) throw new ApiError("حساب الأستاذ غير موجود", 404);
  if (String(teacher.rows[0].role) !== "teacher") {
    throw new ApiError("هذا الحساب ليس حساب أستاذ", 400);
  }
  const existing = await db.query(
    "SELECT id FROM teacher_branch_assignments WHERE teacher_user_id = $1 AND branch_id = $2",
    [tid, bid],
  );
  if (existing.rows.length > 0) {
    throw new ApiError("هذا الأستاذ معين بالفعل لهذا الفرع");
  }
  const now = new Date().toISOString();
  const id = uid("tba");
  await db.query(
    `INSERT INTO teacher_branch_assignments (id, teacher_user_id, branch_id, assigned_by_user_id, assigned_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, tid, bid, actor.id, now],
  );
  return { id, teacherUserId: tid, branchId: bid, assignedAt: now };
}

/** Removes a teacher from a branch. */
export async function removeTeacherFromBranch(
  branchId: string,
  teacherUserId: string,
  actor: SafeUser,
): Promise<void> {
  const bid = requireBranchId(branchId);
  const tid = requireBranchId(teacherUserId);
  await requireBranchAccess(actor, bid);
  const db = await getDb();
  await db.query(
    "DELETE FROM teacher_branch_assignments WHERE teacher_user_id = $1 AND branch_id = $2",
    [tid, bid],
  );
}

// ---------------------------------------------------------------------------
// teaching_assignments (teacher → class+subject per academic year)
// ---------------------------------------------------------------------------

/** Lists teaching assignments with enriched joins. */
export async function listTeachingAssignments(
  user: SafeUser,
  opts?: { teacherUserId?: string; classId?: string; academicYearId?: string },
): Promise<TeachingAssignmentRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.teacherUserId) {
    params.push(opts.teacherUserId);
    where += ` AND ta.teacher_user_id = $${params.length}`;
  }
  if (opts?.classId) {
    params.push(opts.classId);
    where += ` AND ta.class_id = $${params.length}`;
  }
  if (opts?.academicYearId) {
    params.push(opts.academicYearId);
    where += ` AND ta.academic_year_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT ta.id, ta.teacher_user_id, ta.class_id, ta.subject_id, ta.academic_year_id,
            ta.assigned_at,
            u.name_ar AS teacher_name_ar,
            c.name_ar AS class_name_ar,
            s.code AS subject_code,
            ay.label AS year_label,
            c.branch_id
     FROM teaching_assignments ta
     JOIN users u ON u.id = ta.teacher_user_id
     JOIN classes c ON c.id = ta.class_id
     JOIN subjects s ON s.id = ta.subject_id
     JOIN academic_years ay ON ay.id = ta.academic_year_id
     WHERE 1=1${where}
     ORDER BY ta.assigned_at DESC`,
    params,
  );
  return result.rows.map(toTeachingAssignment);
}

/**
 * Creates a teaching assignment: teacher → class+subject in a given academic year.
 * Branch scope is derived from the class and checked against the actor.
 */
export async function createTeachingAssignment(
  input: {
    teacherUserId: string;
    classId: string;
    subjectId: string;
    academicYearId: string;
  },
  actor: SafeUser,
): Promise<TeachingAssignmentRow> {
  const db = await getDb();
  // Validate teacher
  const teacher = await db.query("SELECT id, role FROM users WHERE id = $1", [input.teacherUserId]);
  if (teacher.rows.length === 0) throw new ApiError("حساب الأستاذ غير موجود", 404);
  if (String(teacher.rows[0].role) !== "teacher") throw new ApiError("هذا الحساب ليس حساب أستاذ", 400);
  // Validate class → get branch
  const cls = await db.query("SELECT id, branch_id FROM classes WHERE id = $1", [input.classId]);
  if (cls.rows.length === 0) throw new ApiError("الفصل غير موجود", 404);
  const branchId = String(cls.rows[0].branch_id);
  await requireBranchAccess(actor, branchId);
  // Validate subject
  const subj = await db.query("SELECT id FROM subjects WHERE id = $1", [input.subjectId]);
  if (subj.rows.length === 0) throw new ApiError("المادة غير موجودة", 404);
  // Validate academic year
  const year = await db.query("SELECT id FROM academic_years WHERE id = $1", [input.academicYearId]);
  if (year.rows.length === 0) throw new ApiError("السنة الدراسية غير موجودة", 404);
  // Check uniqueness
  const existing = await db.query(
    `SELECT id FROM teaching_assignments
     WHERE teacher_user_id = $1 AND class_id = $2 AND subject_id = $3 AND academic_year_id = $4`,
    [input.teacherUserId, input.classId, input.subjectId, input.academicYearId],
  );
  if (existing.rows.length > 0) {
    throw new ApiError("توجد بالفعل مهمة تدريس لهذا الأستاذ في هذا الفصل والمادة والسنة");
  }
  const now = new Date().toISOString();
  const id = uid("ta");
  await db.query(
    `INSERT INTO teaching_assignments (id, teacher_user_id, class_id, subject_id, academic_year_id, assigned_by_user_id, assigned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.teacherUserId, input.classId, input.subjectId, input.academicYearId, actor.id, now],
  );
  await writeAudit({
    action: "teaching.assign",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: `teacher=${input.teacherUserId} class=${input.classId} subject=${input.subjectId}`,
    branchId,
  });
  const rows = await listTeachingAssignments(actor, { teacherUserId: input.teacherUserId, classId: input.classId });
  return rows.find((r) => r.id === id) ?? { id, teacherUserId: input.teacherUserId, classId: input.classId, subjectId: input.subjectId, academicYearId: input.academicYearId, assignedAt: now };
}

/** Removes a teaching assignment. */
export async function removeTeachingAssignment(
  assignmentId: string,
  actor: SafeUser,
): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    `SELECT ta.id, c.branch_id
     FROM teaching_assignments ta
     JOIN classes c ON c.id = ta.class_id
     WHERE ta.id = $1`,
    [assignmentId],
  );
  if (row.rows.length === 0) throw new ApiError("المهمة غير موجودة", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM teaching_assignments WHERE id = $1", [assignmentId]);
  await writeAudit({
    action: "teaching.remove",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: assignmentId,
    branchId: String(row.rows[0].branch_id),
  });
}
