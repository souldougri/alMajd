/**
 * Students service (Phase 2A). Student records attach to a single CURRENT
 * branch (`students.branch_id`) while `student_branch_history` tracks every
 * movement, and `student_class_enrollments` tracks class membership per
 * academic year (register / promote / transfer / leave / graduate).
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { uid, writeAudit, deactivateStudentUserServer, upsertStudentUserServer, upsertParentUserServer, resolveParentStudentId, type StudentLoginResult, type ParentLoginResult } from "./auth";
import { ApiError } from "./http";
import { getUserBranchScope, requireBranchAccess, requireBranchHeadOrAdmin, requireBranchId } from "./scope";
import type { SafeUser } from "@/lib/auth/types";

export type StudentRow = {
  id: string;
  nameAr: string;
  nameFr: string;
  gender: string;
  klass: string;
  dob: string;
  placeOfBirth: string;
  parentAr: string;
  phone: string;
  enrolled: string;
  annualFee: number;
  photo?: string;
  email: string;
  branchId: string;
  branchNameAr?: string;
  classId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentBranchHistoryRow = {
  id: string;
  studentId: string;
  branchId: string;
  branchNameAr?: string;
  effectiveDate: string;
  reason: string;
  isCurrent: boolean;
  movedByUserId?: string;
};

export type StudentEnrollmentRow = {
  id: string;
  studentId: string;
  classId: string;
  classNameAr?: string;
  academicYearId: string;
  yearLabel?: string;
  status: "enrolled" | "promoted" | "transferred" | "left" | "graduated";
  enrolledOn: string;
  leftOn?: string | null;
  note: string;
  isCurrent: boolean;
  recordedByUserId?: string;
};

export type CreateStudentInput = {
  /**
   * Optional client-supplied id (kept authoritative so sync references stay
   * intact). Also serves as the registration idempotency key: retries with
   * the same id return the existing record instead of duplicating it.
   */
  id?: string;
  nameAr: string;
  nameFr?: string;
  gender?: string;
  klass?: string;
  /**
   * Optional class reference (preferred over the free-text klass label).
   * The class must exist and belong to the student's branch — enforced below.
   */
  classId?: string;
  dob?: string;
  placeOfBirth?: string;
  parentAr?: string;
  phone?: string;
  enrolled?: string;
  annualFee?: number;
  photo?: string;
  email?: string;
  /** Branch is required at registration (students always belong to a branch). */
  branchId: string;
  /** Optional bound portal login id/password for the student. */
  loginEmail?: string;
  loginPassword?: string;
};

export type UpdateStudentInput = {
  nameAr?: string;
  nameFr?: string;
  gender?: string;
  klass?: string;
  /** Same branch-checked class reference as in CreateStudentInput. */
  classId?: string;
  dob?: string;
  placeOfBirth?: string;
  parentAr?: string;
  phone?: string;
  enrolled?: string;
  annualFee?: number;
  photo?: string;
  email?: string;
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function toStudent(row: DbRow): StudentRow {
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

function toHistory(row: DbRow): StudentBranchHistoryRow {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : undefined,
    effectiveDate: String(row.effective_date),
    reason: String(row.reason ?? ""),
    isCurrent: Boolean(row.is_current),
    movedByUserId: row.moved_by_user_id ? String(row.moved_by_user_id) : undefined,
  };
}

function toEnrollment(row: DbRow): StudentEnrollmentRow {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    classId: String(row.class_id),
    classNameAr: row.class_name_ar ? String(row.class_name_ar) : undefined,
    academicYearId: String(row.academic_year_id),
    yearLabel: row.year_label ? String(row.year_label) : undefined,
    status: String(row.status) as StudentEnrollmentRow["status"],
    enrolledOn: String(row.enrolled_on ?? ""),
    leftOn: row.left_on ? String(row.left_on) : null,
    note: String(row.note ?? ""),
    isCurrent: Boolean(row.is_current),
    recordedByUserId: row.recorded_by_user_id ? String(row.recorded_by_user_id) : undefined,
  };
}

const BASE_STUDENT_SELECT = `
  SELECT s.id, s.name_ar, s.name_fr, s.gender, s.klass, s.dob, s.place_of_birth,
         s.parent_ar, s.phone, s.enrolled, s.annual_fee, s.photo, s.email,
         s.branch_id, s.active, s.created_at, s.updated_at, b.name_ar AS branch_name_ar,
         e.class_id
  FROM students s
  JOIN branches b ON b.id = s.branch_id
  LEFT JOIN student_class_enrollments e ON e.student_id = s.id AND e.is_current = true AND e.status = 'enrolled'`;

async function findStudentRow(db: Awaited<ReturnType<typeof getDb>>, studentId: string): Promise<DbRow | null> {
  const res = await db.query(`${BASE_STUDENT_SELECT} WHERE s.id = $1 LIMIT 1`, [studentId]);
  return res.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// List / get
// ---------------------------------------------------------------------------

/**
 * Lists students. When no branch filter is given, returns all students in the
 * caller's scope (super_admin: all branches). When `branchId` is provided the
 * caller must have access to that branch.
 */
export async function listStudents(
  user: SafeUser,
  opts?: { branchId?: string; includeInactive?: boolean },
): Promise<StudentRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (opts?.branchId) {
    await requireBranchAccess(user, opts.branchId);
    params.push(opts.branchId);
    where += ` AND s.branch_id = $${params.length}`;
  }
  if (!opts?.includeInactive) {
    params.push(true);
    where += ` AND s.active = $${params.length}`;
  }
  const db = await getDb();
  if (!opts?.branchId && user.role !== "super_admin") {
    // Scope filter: only students whose current branch is in the user's scope.
    const scope = await getUserBranchScope(user);
    params.push(scope);
    where += ` AND s.branch_id = ANY($${params.length})`;
  }
  const result = await db.query(`${BASE_STUDENT_SELECT} WHERE 1=1${where} ORDER BY s.name_ar ASC`, params);
  return result.rows.map(toStudent);
}

/** Fetches one student with branch history and class enrollments. */
export async function getStudent(
  studentId: string,
  user: SafeUser,
): Promise<StudentRow & { history: StudentBranchHistoryRow[]; enrollments: StudentEnrollmentRow[] }> {
  const db = await getDb();
  const row = await findStudentRow(db, studentId);
  if (!row) throw new ApiError("الطالب غير موجود", 404);
  const student = toStudent(row);
  await requireBranchAccess(user, student.branchId);
  // A student account may read only its own record — branch scope alone
  // would otherwise expose classmates' full records (parent, phone, ...).
  if (user.role === "student" && user.studentId !== studentId) {
    throw new ApiError("غير مصرح لك بالاطلاع على سجل طالب آخر", 403);
  }
  const historyRes = await db.query(
    `SELECT h.id, h.student_id, h.branch_id, b.name_ar AS branch_name_ar, h.effective_date, h.reason, h.is_current, h.moved_by_user_id
     FROM student_branch_history h
     JOIN branches b ON b.id = h.branch_id
     WHERE h.student_id = $1 ORDER BY h.effective_date ASC, h.id ASC`,
    [studentId],
  );
  const enrollRes = await db.query(
    `SELECT e.id, e.student_id, e.class_id, c.name_ar AS class_name_ar, e.academic_year_id, ay.label AS year_label,
            e.status, e.enrolled_on, e.left_on, e.note, e.is_current, e.recorded_by_user_id
     FROM student_class_enrollments e
     JOIN classes c ON c.id = e.class_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     WHERE e.student_id = $1 ORDER BY ay.start_date IS NULL, e.enrolled_on ASC, e.id ASC`,
    [studentId],
  );
  return {
    ...student,
    history: historyRes.rows.map(toHistory),
    enrollments: enrollRes.rows.map(toEnrollment),
  };
}

/**
 * Account status for a student (login emails only — passwords are never
 * stored nor re-exposed). Reuses getStudent, so branch scope and the
 * student self-only rule apply unchanged.
 */
export async function getStudentLoginStatus(
  studentId: string,
  user: SafeUser,
): Promise<{ student: { email: string } | null; parent: { email: string } | null }> {
  await getStudent(studentId, user);
  const db = await getDb();
  const s = await db.query("SELECT email FROM users WHERE student_id = $1 AND role = 'student' LIMIT 1", [studentId]);
  const p = await db.query("SELECT email FROM users WHERE parent_student_id = $1 AND role = 'parent' LIMIT 1", [studentId]);
  return {
    student: s.rows.length > 0 ? { email: String(s.rows[0].email) } : null,
    parent: p.rows.length > 0 ? { email: String(p.rows[0].email) } : null,
  };
}

// ---------------------------------------------------------------------------
// Register / update
// ---------------------------------------------------------------------------

/**
 * Registers a student in a branch. Creates the initial branch-history row and
 * always provisions the bound portal login via the existing registrar
 * infrastructure (auto-generated id/password unless explicit values given).
 */
/**
 * Resolves an explicit class reference for enrollment: the class must exist
 * and belong to the student's branch (server-side anti-escape check — a
 * forged classId from another branch is rejected, never trusted).
 * Returns the class's canonical label, or null when no classId was given
 * (legacy free-text klass path stays untouched).
 */
async function resolveEnrollmentClass(
  db: Awaited<ReturnType<typeof getDb>>,
  classId: string | undefined,
  branchId: string,
): Promise<{ id: string; klassLabel: string } | null> {
  const cid = classId?.trim() || "";
  if (!cid) return null;
  const cls = await db.query("SELECT id, name_ar, branch_id FROM classes WHERE id = $1 LIMIT 1", [cid]);
  if (cls.rows.length === 0) throw new ApiError("الفصل غير موجود", 404);
  if (String(cls.rows[0].branch_id) !== branchId) {
    throw new ApiError("الفصل لا ينتمي إلى فرع الطالب", 403);
  }
  return { id: String(cls.rows[0].id), klassLabel: String(cls.rows[0].name_ar) };
}

/**
 * Keeps the class enrollment consistent with the student's `klass` label so the
 * store-driven flows can grade/attendance-mark relationally. Idempotent: no-op
 * when the student already has a current enrollment in the matching class.
 */
async function ensureEnrollmentForKlass(
  db: Awaited<ReturnType<typeof getDb>>,
  studentId: string,
  branchId: string,
  klass: string | undefined,
  actor: SafeUser,
  explicitClassId?: string,
): Promise<void> {
  // Exact class reference wins over label matching (avoids same-name classes
  // across academic years resolving to the wrong row).
  if (explicitClassId?.trim()) {
    const exact = await db.query(
      `SELECT c.id, c.academic_year_id
         FROM classes c
        WHERE c.id = $1 AND c.branch_id = $2 AND c.active = true
        LIMIT 1`,
      [explicitClassId.trim(), branchId],
    );
    if (exact.rows.length > 0) {
      await applyEnrollment(db, studentId, String(exact.rows[0].id), String(exact.rows[0].academic_year_id), actor);
      return;
    }
  }
  const name = (klass ?? "").trim();
  if (!name) return;
  const cls = await db.query(
    `SELECT c.id, c.academic_year_id
       FROM classes c
       LEFT JOIN academic_years ay ON ay.id = c.academic_year_id AND ay.is_current = true
      WHERE c.branch_id = $1 AND c.name_ar = $2 AND c.active = true
      ORDER BY ay.is_current DESC NULLS LAST, c.academic_year_id ASC
      LIMIT 1`,
    [branchId, name],
  );
  if (cls.rows.length === 0) return;
  await applyEnrollment(db, studentId, String(cls.rows[0].id), String(cls.rows[0].academic_year_id), actor);
}

async function applyEnrollment(
  db: Awaited<ReturnType<typeof getDb>>,
  studentId: string,
  classId: string,
  yearId: string,
  actor: SafeUser,
): Promise<void> {
  const current = await db.query(
    "SELECT id, class_id FROM student_class_enrollments WHERE student_id = $1 AND is_current = true",
    [studentId],
  );
  if (current.rows.length > 0 && String(current.rows[0].class_id) === classId) return;

  if (current.rows.length > 0) {
    await db.query(
      `UPDATE student_class_enrollments SET is_current = false, status = 'transferred', left_on = $2
        WHERE student_id = $1 AND is_current = true`,
      [studentId, new Date().toISOString()],
    );
  }
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id)
     VALUES ($1, $2, $3, $4, 'enrolled', $5, true, $6)
     ON CONFLICT (student_id, class_id, academic_year_id)
     DO UPDATE SET status = 'enrolled', is_current = true, left_on = NULL, recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
    [uid("enr"), studentId, classId, yearId, now, actor.id],
  );
}

/**
 * Student record writes (register/edit/remove) require super_admin, registrar
 * duty, or the acting Branch Head of the student's branch — mere branch
 * membership (e.g. an assigned teacher) is not enough.
 */
async function requireStudentWriteAuthority(actor: SafeUser, branchId: string): Promise<void> {
  await requireBranchAccess(actor, branchId);
  if (actor.role !== "super_admin" && !actor.duties.includes("registrar")) {
    await requireBranchHeadOrAdmin(actor, branchId);
  }
}

export async function registerStudent(
  input: CreateStudentInput,
  actor: SafeUser,
): Promise<{ student: StudentRow; login: { student: StudentLoginResult; parent: ParentLoginResult } }> {
  const nameAr = input.nameAr.trim();
  if (!nameAr) throw new ApiError("يرجى إدخال اسم الطالب");
  const bid = requireBranchId(input.branchId);
  await requireStudentWriteAuthority(actor, bid);
  const db = await getDb();
  const branch = await db.query("SELECT id, name_ar FROM branches WHERE id = $1", [bid]);
  if (branch.rows.length === 0) throw new ApiError("الفرع غير موجود", 404);

  const now = new Date().toISOString();
  const id = input.id?.trim() || uid("stu");
  // Idempotency: a client-supplied id doubles as the idempotency key for the
  // whole registration (record + login). A retry with the same key — double
  // submit, timeout retry, re-synced op — returns the already-registered
  // record instead of creating a duplicate. The branch guard below keeps a
  // key from one branch from ever resolving a record of another branch (such
  // a call falls through to the INSERT and fails safely on the PK).
  const prior = await findStudentRow(db, id);
  if (prior && String(prior.branch_id) === bid) {
    const existing = toStudent(prior);
    // Replay also heals: if the first attempt died before provisioning the
    // logins, the same retry creates them now instead of duplicating the row.
    const studentLogin = await upsertStudentUserServer(
      { nameAr: existing.nameAr, studentId: id, active: true },
      actor,
    );
    const parentLogin = await upsertParentUserServer(
      { nameAr: input.parentAr?.trim() || existing.parentAr || `ولي أمر ${existing.nameAr}`, studentId: id, active: true },
      actor,
    );
    return { student: existing, login: { student: studentLogin, parent: parentLogin } };
  }
  const annualFee = Number.isFinite(input.annualFee) ? Number(input.annualFee) : 0;
  // Explicit class reference wins: validated against this branch, and its
  // canonical label becomes the student's klass (legacy label path untouched
  // when no classId is sent).
  const classRef = await resolveEnrollmentClass(db, input.classId, bid);
  const klassLabel = classRef ? classRef.klassLabel : (input.klass ?? "");
  await db.query(
    `INSERT INTO students (id, name_ar, name_fr, gender, klass, dob, place_of_birth, parent_ar, phone, enrolled, annual_fee, photo, email, branch_id, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, $15)`,
    [
      id,
      nameAr,
      input.nameFr?.trim() ?? "",
      input.gender ?? "male",
      klassLabel,
      input.dob ?? "",
      input.placeOfBirth ?? "",
      input.parentAr ?? "",
      input.phone ?? "",
      input.enrolled ?? "",
      annualFee,
      input.photo ?? null,
      input.email ?? "",
      bid,
      now,
    ],
  );
  await db.query(
    `INSERT INTO student_branch_history (id, student_id, branch_id, effective_date, reason, is_current, moved_by_user_id)
     VALUES ($1, $2, $3, $4, 'registration', true, $5)`,
    [uid("sbh"), id, bid, now, actor.id],
  );

  // Both portal logins are part of registration itself (never opt-in): ids
  // and passwords are auto-generated unless the registrar supplied explicit
  // student values. There is no multi-statement transaction primitive in the
  // DbLike layer, so partial failure is handled by compensation — if either
  // provisioning fails after rows were written, everything created by this
  // call (parent account, student account, history, student) is removed again
  // and the error propagates, never silently leaving a partial registration.
  // (The pre-existing manual «حساب الدخول» flow stays available for students
  // registered before this behavior.)
  let login: { student: StudentLoginResult; parent: ParentLoginResult };
  let studentUserId = "";
  let parentUserId = "";
  try {
    const studentLogin = await upsertStudentUserServer(
      {
        nameAr,
        nameEn: input.nameFr?.trim() || undefined,
        email: input.loginEmail ?? undefined,
        initialPassword: input.loginPassword ?? undefined,
        studentId: id,
        active: true,
      },
      actor,
    );
    studentUserId = studentLogin.user.id;
    const parentLogin = await upsertParentUserServer(
      {
        nameAr: input.parentAr?.trim() || `ولي أمر ${nameAr}`,
        studentId: id,
        active: true,
      },
      actor,
    );
    parentUserId = parentLogin.user.id;
    login = { student: studentLogin, parent: parentLogin };
  } catch (err) {
    if (parentUserId) await db.query("DELETE FROM users WHERE id = $1", [parentUserId]);
    if (studentUserId) await db.query("DELETE FROM users WHERE id = $1", [studentUserId]);
    await db.query("DELETE FROM student_branch_history WHERE student_id = $1", [id]);
    await db.query("DELETE FROM students WHERE id = $1", [id]);
    throw err;
  }

  await writeAudit({
    action: "student.register",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: nameAr,
    branchId: bid,
    entityType: "student",
    detail: `registered student in branch ${String(branch.rows[0].name_ar)}`,
  });
  await ensureEnrollmentForKlass(db, id, bid, klassLabel, actor, classRef?.id);
  const row = await findStudentRow(db, id);
  return { student: toStudent(row!), login };
}

export async function updateStudent(
  studentId: string,
  input: UpdateStudentInput,
  actor: SafeUser,
): Promise<StudentRow> {
  const db = await getDb();
  const current = await findStudentRow(db, studentId);
  if (!current) throw new ApiError("الطالب غير موجود", 404);
  await requireStudentWriteAuthority(actor, String(current.branch_id));

  const nameAr = (input.nameAr ?? "").trim() || String(current.name_ar);
  const annualFee = input.annualFee !== undefined ? Number(input.annualFee) : Number(current.annual_fee ?? 0);
  // Explicit class reference wins here too (same branch check as registration);
  // otherwise the legacy klass label behavior is preserved untouched.
  const classRef = await resolveEnrollmentClass(db, input.classId, String(current.branch_id));
  const klassValue = classRef ? classRef.klassLabel : (input.klass !== undefined ? input.klass : String(current.klass ?? ""));
  const now = new Date().toISOString();
  await db.query(
    `UPDATE students SET
       name_ar = $1, name_fr = $2, gender = $3, klass = $4, dob = $5, place_of_birth = $6,
       parent_ar = $7, phone = $8, enrolled = $9, annual_fee = $10, photo = $11, email = $12, updated_at = $13
     WHERE id = $14`,
    [
      nameAr,
      input.nameFr !== undefined ? input.nameFr.trim() : current.name_fr,
      input.gender ?? current.gender ?? "male",
      klassValue,
      input.dob !== undefined ? input.dob : current.dob,
      input.placeOfBirth !== undefined ? input.placeOfBirth : current.place_of_birth,
      input.parentAr !== undefined ? input.parentAr : current.parent_ar,
      input.phone !== undefined ? input.phone : current.phone,
      input.enrolled !== undefined ? input.enrolled : current.enrolled,
      annualFee,
      input.photo !== undefined ? input.photo : current.photo ?? null,
      input.email !== undefined ? input.email : current.email,
      now,
      studentId,
    ],
  );
  await writeAudit({
    action: "student.update",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: studentId,
    targetName: nameAr,
    branchId: String(current.branch_id),
    entityType: "student",
    detail: "updated student record",
  });
  if (input.klass !== undefined || classRef) {
    await ensureEnrollmentForKlass(db, studentId, String(current.branch_id), klassValue, actor, classRef?.id);
  }
  const row = await findStudentRow(db, studentId);
  return toStudent(row!);
}

// ---------------------------------------------------------------------------
// Transfer (branch history) + promotion
// ---------------------------------------------------------------------------

/**
 * Transfers a student to another branch. Updates the current branch, records a
 * new history row, and closes any open class enrollment with status
 * 'transferred'. Optionally enrolls the student in a target class.
 */
export async function transferStudent(
  studentId: string,
  toBranchId: string,
  actor: SafeUser,
  opts?: {
    effectiveDate?: string;
    reason?: string;
    toClassId?: string;
    academicYearId?: string;
  },
): Promise<StudentRow & { history: StudentBranchHistoryRow[] }> {
  requireBranchId(studentId);
  const toBid = requireBranchId(toBranchId);
  const db = await getDb();
  const src = await findStudentRow(db, studentId);
  if (!src) throw new ApiError("الطالب غير موجود", 404);
  await requireBranchAccess(actor, String(src.branch_id));
  await requireBranchAccess(actor, toBid); // both branches must be in scope

  if (String(src.branch_id) === toBid) {
    throw new ApiError("الطالب مسجل في هذا الفرع بالفعل");
  }
  const targetBranch = await db.query("SELECT id, name_ar FROM branches WHERE id = $1", [toBid]);
  if (targetBranch.rows.length === 0) throw new ApiError("الفرع الهدف غير موجود", 404);

  const effective = opts?.effectiveDate?.trim() || new Date().toISOString();
  const now = new Date().toISOString();

  // Close the current open enrollment as transferred.
  await db.query(
    `UPDATE student_class_enrollments SET status = 'transferred', is_current = false,
            left_on = COALESCE(left_on, $1) WHERE student_id = $2 AND is_current = true AND status = 'enrolled'`,
    [effective, studentId],
  );

  // Update current branch.
  await db.query("UPDATE students SET branch_id = $1, updated_at = $2 WHERE id = $3", [toBid, now, studentId]);

  // Record the movement: old history row becomes non-current, new row is current.
  await db.query(
    "UPDATE student_branch_history SET is_current = false WHERE student_id = $1 AND is_current = true",
    [studentId],
  );
  await db.query(
    `INSERT INTO student_branch_history (id, student_id, branch_id, effective_date, reason, is_current, moved_by_user_id)
     VALUES ($1, $2, $3, $4, $5, true, $6)`,
    [uid("sbh"), studentId, toBid, effective, opts?.reason?.trim() || "transfer", actor.id],
  );

  // Optional new-class enrollment in the target branch.
  if (opts?.toClassId && opts?.academicYearId) {
    const cls = await db.query("SELECT id, branch_id FROM classes WHERE id = $1", [opts.toClassId]);
    if (cls.rows.length === 0) throw new ApiError("الفصل الهدف غير موجود", 404);
    if (String(cls.rows[0].branch_id) !== toBid) {
      throw new ApiError("الفصل الهدف ينتمي إلى فرع مختلف عن الفرع الهدف", 400);
    }
    await db.query(
      `INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, note, is_current, recorded_by_user_id)
       VALUES ($1, $2, $3, $4, 'enrolled', $5, $6, true, $7)
       ON CONFLICT (student_id, class_id, academic_year_id) DO NOTHING`,
      [uid("sce"), studentId, opts.toClassId, opts.academicYearId, effective, opts.reason?.trim() || "", actor.id],
    );
  }

  await writeAudit({
    action: "student.transfer",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: studentId,
    targetName: String(src.name_ar),
    branchId: toBid,
    entityType: "student",
    detail: `transferred to branch ${String(targetBranch.rows[0].name_ar)}`,
  });

  const historyRows = await db.query(
    `SELECT h.id, h.student_id, h.branch_id, b.name_ar AS branch_name_ar, h.effective_date, h.reason, h.is_current, h.moved_by_user_id
     FROM student_branch_history h JOIN branches b ON b.id = h.branch_id
     WHERE h.student_id = $1 ORDER BY h.effective_date ASC, h.id ASC`,
    [studentId],
  );
  const fresh = await findStudentRow(db, studentId);
  return { ...toStudent(fresh!), history: historyRows.rows.map(toHistory) };
}

/**
 * Promotes a student to a new class in the next academic year, closing the
 * previous enrollment. Used by registrar/academic desk. Branch scope enforced
 * via the student's current branch.
 */
export async function promoteStudent(
  studentId: string,
  toClassId: string,
  actor: SafeUser,
  opts?: { academicYearId?: string; note?: string },
): Promise<StudentEnrollmentRow> {
  requireBranchId(studentId);
  const db = await getDb();
  const src = await findStudentRow(db, studentId);
  if (!src) throw new ApiError("الطالب غير موجود", 404);
  await requireBranchAccess(actor, String(src.branch_id));

  const cls = await db.query("SELECT id, branch_id, name_ar FROM classes WHERE id = $1", [toClassId]);
  if (cls.rows.length === 0) throw new ApiError("الفصل الهدف غير موجود", 404);
  if (String(cls.rows[0].branch_id) !== String(src.branch_id)) {
    throw new ApiError("لا يمكن ترقية الطالب إلى فصل في فرع مختلف — استخدم النقل أولاً", 400);
  }

  // Resolve the academic year: caller-provided or the current academic year.
  const yearRes = opts?.academicYearId
    ? await db.query("SELECT id FROM academic_years WHERE id = $1", [opts.academicYearId])
    : await db.query("SELECT id FROM academic_years WHERE is_current = true LIMIT 1");
  if (yearRes.rows.length === 0) throw new ApiError("لا توجد سنة دراسية متاحة", 400);
  const academicYearId = String(yearRes.rows[0].id);

  const now = new Date().toISOString();
  // Close current enrollment.
  await db.query(
    `UPDATE student_class_enrollments SET status = 'promoted', is_current = false,
            left_on = COALESCE(left_on, $1) WHERE student_id = $2 AND is_current = true AND status IN ('enrolled','promoted')`,
    [now, studentId],
  );
  // Update the student's current class label.
  await db.query("UPDATE students SET klass = $1, updated_at = $2 WHERE id = $3", [String(cls.rows[0].name_ar), now, studentId]);
  const enrollmentId = uid("sce");
  await db.query(
    `INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, note, is_current, recorded_by_user_id)
     VALUES ($1, $2, $3, $4, 'enrolled', $5, $6, true, $7)
     ON CONFLICT (student_id, class_id, academic_year_id) DO NOTHING`,
    [enrollmentId, studentId, toClassId, academicYearId, now, opts?.note?.trim() ?? "", actor.id],
  );
  await writeAudit({
    action: "student.promote",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: studentId,
    targetName: String(src.name_ar),
    branchId: String(src.branch_id),
    entityType: "student",
    detail: `promoted to class ${String(cls.rows[0].name_ar)}`,
  });

  const fresh = await db.query(
    `SELECT e.id, e.student_id, e.class_id, c.name_ar AS class_name_ar, e.academic_year_id, ay.label AS year_label,
            e.status, e.enrolled_on, e.left_on, e.note, e.is_current, e.recorded_by_user_id
     FROM student_class_enrollments e
     JOIN classes c ON c.id = e.class_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     WHERE e.id = $1`,
    [enrollmentId],
  );
  if (fresh.rows.length === 0) {
    // Conflicted with an existing row — fetch it.
    const existing = await db.query(
      `SELECT e.id, e.student_id, e.class_id, c.name_ar AS class_name_ar, e.academic_year_id, ay.label AS year_label,
              e.status, e.enrolled_on, e.left_on, e.note, e.is_current, e.recorded_by_user_id
       FROM student_class_enrollments e
       JOIN classes c ON c.id = e.class_id
       JOIN academic_years ay ON ay.id = e.academic_year_id
       WHERE e.student_id = $1 AND e.class_id = $2 AND e.academic_year_id = $3`,
      [studentId, toClassId, academicYearId],
    );
    return toEnrollment(existing.rows[0]);
  }
  return toEnrollment(fresh.rows[0]);
}

/** Marks a student inactive (soft delete) and deactivates their portal login. */
export async function removeStudent(studentId: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const src = await findStudentRow(db, studentId);
  if (!src) throw new ApiError("الطالب غير موجود", 404);
  await requireStudentWriteAuthority(actor, String(src.branch_id));
  await db.query("UPDATE students SET active = false, updated_at = $1 WHERE id = $2", [new Date().toISOString(), studentId]);
  await deactivateStudentUserServer(studentId, actor);
  await writeAudit({
    action: "student.delete",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: studentId,
    targetName: String(src.name_ar),
    branchId: String(src.branch_id),
    entityType: "student",
    detail: "student removed (inactive)",
  });
}

// ---------------------------------------------------------------------------
// Student portfolio (relational version for portal)
// ---------------------------------------------------------------------------

export type StudentPortfolioRow = {
  student: StudentRow & { classId?: string };
  className: string;
  terms: Array<{ id: string; nameAr: string; nameFr: string; order: number; active: boolean }>;
  subjects: Array<{ id: string; code?: string; nameAr: string; nameFr?: string; coefficient: number; maxScore: number; active: boolean }>;
  grades: Array<{ id: string; studentId: string; subjectId: string; termId: string; score: number; maxScore: number; date?: string; note?: string }>;
  payments: Array<{ id: string; amount: number; date: string; note?: string }>;
  warnings: Array<{ id: string; kind: string; date: string; body?: string }>;
  attendance: Array<{ date: string; status: string }>;
  timetable: Array<{ day: number; slot: number; subjectId: string }>;
  publishedTerms: Record<string, boolean>;
  annualFee: number;
  paid: number;
  remaining: number;
};

/**
 * Fetches the student's portfolio from the relational database.
 * This is the relational replacement for `server/school.ts` getStudentPortfolio.
 * Critically: grades are ONLY returned for published terms (published_results table).
 */
export async function getStudentPortfolioRelational(studentId: string, user: SafeUser): Promise<StudentPortfolioRow> {
  const db = await getDb();
  const studentRow = await findStudentRow(db, studentId);
  if (!studentRow) {
    throw new ApiError("الطالب غير موجود", 404);
  }
  const student = toStudent(studentRow);
  await requireBranchAccess(user, student.branchId);
  return buildStudentPortfolio(studentId);
}

/**
 * Linked student record for a parent account. Powers GET /api/parent/student.
 */
export async function getParentLinkedStudent(parentUserId: string): Promise<StudentRow> {
  const db = await getDb();
  const linkedId = await resolveParentStudentId(parentUserId);
  const row = await findStudentRow(db, linkedId);
  if (!row) throw new ApiError("الطالب المرتبط غير موجود", 404);
  return toStudent(row);
}

/**
 * Link-resolved portfolio for a parent account: the database link is the
 * entire authorization (no branch scope required, no client studentId ever
 * trusted). Reuses the exact student portfolio builder below — same data,
 * same published-only grades rule. Powers GET /api/parent/portfolio.
 */
export async function getParentStudentPortfolio(parentUserId: string): Promise<StudentPortfolioRow> {
  const linkedId = await resolveParentStudentId(parentUserId);
  const db = await getDb();
  const row = await findStudentRow(db, linkedId);
  if (!row) throw new ApiError("الطالب المرتبط غير موجود", 404);
  return buildStudentPortfolio(linkedId);
}

async function buildStudentPortfolio(studentId: string): Promise<StudentPortfolioRow> {
  const db = await getDb();
  const studentRow = await findStudentRow(db, studentId);
  if (!studentRow) {
    throw new ApiError("الطالب غير موجود", 404);
  }
  const student = toStudent(studentRow);

  // Get current class enrollment
  const enrollmentRes = await db.query(
    `SELECT e.class_id, c.name_ar AS class_name_ar, e.academic_year_id, ay.label AS year_label
     FROM student_class_enrollments e
     JOIN classes c ON c.id = e.class_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     WHERE e.student_id = $1 AND e.is_current = true AND e.status = 'enrolled'
     LIMIT 1`,
    [studentId],
  );

  const classId = enrollmentRes.rows.length > 0 ? String(enrollmentRes.rows[0].class_id) : null;
  const className = enrollmentRes.rows.length > 0 ? String(enrollmentRes.rows[0].class_name_ar) : student.klass;
  const academicYearId = enrollmentRes.rows.length > 0 ? String(enrollmentRes.rows[0].academic_year_id) : null;

  // Get active terms
  const termsRes = await db.query('SELECT id, name_ar, name_fr, "order", active FROM terms WHERE active = true ORDER BY "order" ASC');
  const terms = termsRes.rows.map((r) => ({
    id: String(r.id),
    nameAr: String(r.name_ar),
    nameFr: String(r.name_fr),
    order: Number(r.order),
    active: Boolean(r.active),
  }));

  // Get subjects for the student's class
  let subjects: Array<{ id: string; code?: string; nameAr: string; nameFr?: string; coefficient: number; maxScore: number; active: boolean }> = [];
  if (classId) {
    const subjectsRes = await db.query(
      `SELECT s.id, s.code, s.name_ar, s.name_fr, cs.coefficient, cs.max_score, cs.active
       FROM class_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
       WHERE cs.class_id = $1 AND cs.active = true
       ORDER BY s.name_ar ASC`,
      [classId],
    );
    subjects = subjectsRes.rows.map((r) => ({
      id: String(r.id),
      code: r.code ? String(r.code) : undefined,
      nameAr: String(r.name_ar),
      nameFr: r.name_fr ? String(r.name_fr) : undefined,
      coefficient: Number(r.coefficient),
      maxScore: Number(r.max_score),
      active: Boolean(r.active),
    }));
  }

  // Get published terms for this class
  const publishedTerms: Record<string, boolean> = {};
  if (classId) {
    const publishedRes = await db.query(
      "SELECT term_id, published FROM published_results WHERE class_id = $1",
      [classId],
    );
    for (const row of publishedRes.rows) {
      publishedTerms[String(row.term_id)] = Boolean(row.published);
    }
  }

  // Get grades ONLY for published terms (CRITICAL security requirement)
  let grades: Array<{ id: string; studentId: string; subjectId: string; termId: string; score: number; maxScore: number; date?: string; note?: string }> = [];
  if (classId) {
    const publishedTermIds = Object.entries(publishedTerms)
      .filter(([, published]) => published)
      .map(([termId]) => termId);

    if (publishedTermIds.length > 0) {
      const gradesRes = await db.query(
        `SELECT g.id, g.student_id, a.subject_id, a.term_id, g.score, a.max_score, a.date, g.note
         FROM grades g
         JOIN assessments a ON a.id = g.assessment_id
         WHERE g.student_id = $1 AND a.class_id = $2 AND a.term_id = ANY($3::text[])
         ORDER BY a.term_id ASC, a.subject_id ASC`,
        [studentId, classId, publishedTermIds],
      );
      grades = gradesRes.rows.map((r) => ({
        id: String(r.id),
        studentId: String(r.student_id),
        subjectId: String(r.subject_id),
        termId: String(r.term_id),
        score: Number(r.score),
        maxScore: Number(r.max_score),
        date: r.date ? String(r.date) : undefined,
        note: r.note ? String(r.note) : undefined,
      }));
    }
  }

  // Get payments
  const paymentsRes = await db.query(
    `SELECT id, amount, date, note FROM payments WHERE student_id = $1 ORDER BY date DESC`,
    [studentId],
  );
  const payments = paymentsRes.rows.map((r) => ({
    id: String(r.id),
    amount: Number(r.amount),
    date: String(r.date),
    note: r.note ? String(r.note) : undefined,
  }));

  // Get warnings
  const warningsRes = await db.query(
    `SELECT id, kind, date, body FROM warnings WHERE student_id = $1 ORDER BY date DESC`,
    [studentId],
  );
  const warnings = warningsRes.rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    date: String(r.date),
    body: r.body ? String(r.body) : undefined,
  }));

  // Get attendance
  const attendance: Array<{ date: string; status: string }> = [];
  if (classId) {
    const attendanceRes = await db.query(
      `SELECT date, status FROM attendance WHERE class_id = $1 AND student_id = $2 ORDER BY date DESC`,
      [classId, studentId],
    );
    attendanceRes.rows.forEach((r) => {
      attendance.push({ date: String(r.date), status: String(r.status) });
    });
  }

  // Get timetable
  const timetable: Array<{ day: number; slot: number; subjectId: string }> = [];
  if (classId) {
    const timetableRes = await db.query(
      `SELECT day, slot, subject_id FROM timetable_entries WHERE class_id = $1 ORDER BY day ASC, slot ASC`,
      [classId],
    );
    timetableRes.rows.forEach((r) => {
      timetable.push({ day: Number(r.day), slot: Number(r.slot), subjectId: String(r.subject_id) });
    });
  }

  // Calculate payment totals
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const annualFee = Number(student.annualFee ?? 0);
  const remaining = Math.max(annualFee - paid, 0);

  return {
    student,
    className,
    terms,
    subjects,
    grades,
    payments,
    warnings,
    attendance,
    timetable,
    publishedTerms,
    annualFee,
    paid,
    remaining,
  };
}