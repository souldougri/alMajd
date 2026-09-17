/**
 * Attendance records and student warnings (Phase 2A). Attendance is class-based
 * and therefore branch-scoped via the class; warnings carry their own branch.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { getUserBranchScope, isAllScope, requireBranchAccess } from "./scope";
import { uid, writeAudit } from "./auth";
import type { SafeUser } from "@/lib/auth/types";

export const ATTENDANCE_STATUSES = ["present", "absent", "late"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceRow = {
  id: string;
  classId: string;
  classNameAr: string;
  branchId: string;
  studentId: string;
  studentNameAr: string;
  date: string;
  status: AttendanceStatus;
  markedByName: string;
  createdAt: string;
};

export type WarningRow = {
  id: string;
  studentId: string;
  studentNameAr: string;
  branchId: string;
  branchNameAr: string;
  kind: string;
  date: string;
  body: string;
  createdByName: string;
};

export const WARNING_KINDS = ["absence", "behavior", "academic"] as const;
export type WarningKind = (typeof WARNING_KINDS)[number];

function toAttendance(row: DbRow): AttendanceRow {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    classNameAr: row.class_name_ar ? String(row.class_name_ar) : "",
    branchId: String(row.branch_id),
    studentId: String(row.student_id),
    studentNameAr: row.student_name_ar ? String(row.student_name_ar) : "",
    date: String(row.date),
    status: String(row.status) as AttendanceStatus,
    markedByName: row.marked_by_name ? String(row.marked_by_name) : "",
    createdAt: String(row.created_at),
  };
}

function toWarning(row: DbRow): WarningRow {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    studentNameAr: row.student_name_ar ? String(row.student_name_ar) : "",
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : "",
    kind: String(row.kind),
    date: String(row.date),
    body: String(row.body ?? ""),
    createdByName: row.created_by_name ? String(row.created_by_name) : "",
  };
}

async function requireClassBranch(actor: SafeUser, classId: string): Promise<string> {
  const result = await (
    await getDb()
  ).query("SELECT id, branch_id FROM classes WHERE id = $1 LIMIT 1", [classId]);
  if (result.rows.length === 0) throw new ApiError("الصف غير موجود", 404);
  const branchId = String(result.rows[0].branch_id);
  await requireBranchAccess(actor, branchId);
  return branchId;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function listAttendance(
  actor: SafeUser,
  opts: { classId: string; date?: string },
): Promise<AttendanceRow[]> {
  await requireClassBranch(actor, opts.classId);
  const params: unknown[] = [opts.classId];
  let where = "a.class_id = $1";
  if (opts.date) {
    params.push(opts.date);
    where += ` AND a.date = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT a.id, a.class_id, c.name_ar AS class_name_ar, c.branch_id, a.student_id, st.name_ar AS student_name_ar,
            a.date, a.status, COALESCE(u.name_ar, '') AS marked_by_name, a.created_at
     FROM attendance a
     JOIN classes c ON c.id = a.class_id
     JOIN students st ON st.id = a.student_id
     LEFT JOIN users u ON u.id = a.marked_by_user_id
     WHERE ${where}
     ORDER BY st.name_ar ASC, a.id ASC`,
    params,
  );
  return result.rows.map(toAttendance);
}

export async function markAttendance(
  actor: SafeUser,
  input: { classId: string; studentId: string; date: string; status: string },
): Promise<AttendanceRow> {
  if (!ATTENDANCE_STATUSES.includes(input.status as AttendanceStatus)) {
    throw new ApiError("حالة الحضور غير صالحة");
  }
  if (!input.date) throw new ApiError("تاريخ الحضور مطلوب");
  const db = await getDb();
  const branchId = await requireClassBranch(actor, input.classId);

  const enrolled = await db.query(
    "SELECT 1 FROM student_class_enrollments WHERE class_id = $1 AND student_id = $2 AND status = 'enrolled'",
    [input.classId, input.studentId],
  );
  if (enrolled.rows.length === 0) throw new ApiError("الطالب غير مسجل في هذا الصف");

  const id = uid("att");
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO attendance (id, class_id, student_id, date, status, marked_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (class_id, student_id, date) DO UPDATE
       SET status = EXCLUDED.status, marked_by_user_id = EXCLUDED.marked_by_user_id
     RETURNING id`,
    [id, input.classId, input.studentId, input.date, input.status, actor.id, now],
  );
  await writeAudit({
    action: "attendance.mark",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: `${input.classId}:${input.studentId}`,
    targetName: "حضور",
    branchId,
    entityType: "attendance",
    detail: `${input.date}: ${input.status}`,
  });

  const list = await listAttendance(actor, { classId: input.classId, date: input.date });
  const found = list.find((a) => a.studentId === input.studentId);
  if (!found) throw new ApiError("تعذر قراءة سجل الحضور", 500);
  return found;
}

export async function removeAttendance(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query(
    `SELECT a.id, c.branch_id FROM attendance a JOIN classes c ON c.id = a.class_id WHERE a.id = $1`,
    [id],
  );
  if (row.rows.length === 0) throw new ApiError("سجل الحضور غير موجود", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM attendance WHERE id = $1", [id]);
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export async function listWarnings(
  actor: SafeUser,
  opts?: { branchId?: string; studentId?: string },
): Promise<WarningRow[]> {
  const scope = await getUserBranchScope(actor);
  const params: unknown[] = [];
  let where = "1=1";
  if (!isAllScope(scope)) {
    params.push(scope);
    where += ` AND w.branch_id = ANY($${params.length}::text[])`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND w.branch_id = $${params.length}`;
  }
  if (opts?.studentId) {
    params.push(opts.studentId);
    where += ` AND w.student_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT w.id, w.student_id, st.name_ar AS student_name_ar, w.branch_id, b.name_ar AS branch_name_ar,
            w.kind, w.date, w.body, COALESCE(u.name_ar, '') AS created_by_name
     FROM warnings w
     JOIN students st ON st.id = w.student_id
     JOIN branches b ON b.id = w.branch_id
     LEFT JOIN users u ON u.id = w.created_by_user_id
     WHERE ${where}
     ORDER BY w.date DESC, w.id DESC`,
    params,
  );
  return result.rows.map(toWarning);
}

export async function createWarning(
  actor: SafeUser,
  input: { id?: string; studentId: string; branchId: string; kind: string; date: string; body?: string },
): Promise<WarningRow> {
  if (!WARNING_KINDS.includes(input.kind as WarningKind)) {
    throw new ApiError("نوع الإنذار غير صالح");
  }
  if (!input.date) throw new ApiError("تاريخ الإنذار مطلوب");
  const db = await getDb();
  await requireBranchAccess(actor, input.branchId);

  const student = await db.query(
    "SELECT id, name_ar, branch_id FROM students WHERE id = $1 AND active = true",
    [input.studentId],
  );
  if (student.rows.length === 0) throw new ApiError("الطالب غير موجود", 404);
  if (String(student.rows[0].branch_id) !== input.branchId) {
    throw new ApiError("الطالب لا ينتمي إلى هذا الفرع");
  }

  const id = input.id?.trim() || uid("wrn");
  await db.query(
    `INSERT INTO warnings (id, student_id, branch_id, kind, date, body, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.studentId, input.branchId, input.kind, input.date, input.body ?? "", actor.id],
  );
  await writeAudit({
    action: "warning.add",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: String(student.rows[0].name_ar),
    branchId: input.branchId,
    entityType: "warning",
    detail: `${input.kind} بتاريخ ${input.date}`,
  });

  const result = await db.query(
    `SELECT w.id, w.student_id, st.name_ar AS student_name_ar, w.branch_id, b.name_ar AS branch_name_ar,
            w.kind, w.date, w.body, COALESCE(u.name_ar, '') AS created_by_name
     FROM warnings w
     JOIN students st ON st.id = w.student_id
     JOIN branches b ON b.id = w.branch_id
     LEFT JOIN users u ON u.id = w.created_by_user_id
     WHERE w.id = $1`,
    [id],
  );
  return toWarning(result.rows[0]);
}

export async function removeWarning(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id FROM warnings WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("الإنذار غير موجود", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM warnings WHERE id = $1", [id]);
}