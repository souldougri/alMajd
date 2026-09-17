/**
 * Teachers service (Phase 2A). Teacher identity lives on `users` (role =
 * 'teacher'); multi-branch membership lives in `teacher_branch_assignments`
 * and class+subject loads in `teaching_assignments`. There is deliberately no
 * separate `teachers` table — teacher accounts are users.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { getUserBranchScope, hasBranchAccess, isAllScope, requireBranchAccess } from "./scope";
import { listTeachingAssignments, type TeachingAssignmentRow } from "./assignments";
import type { SafeUser } from "@/lib/auth/types";

export type TeacherRow = {
  id: string;
  email: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  staffId?: string;
  createdAt: string;
  updatedAt: string;
  branchIds: string[];
};

function toTeacherRow(row: DbRow, branchIds: string[]): TeacherRow {
  return {
    id: String(row.id),
    email: String(row.email),
    nameAr: String(row.name_ar),
    nameEn: String(row.name_en ?? ""),
    active: Boolean(row.active),
    staffId: row.staff_id ? String(row.staff_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    branchIds,
  };
}

function toBranchIds(rows: DbRow[]): string[] {
  return rows.map((r) => String(r.branch_id)).filter((id, i, arr) => arr.indexOf(id) === i);
}

/**
 * Lists teacher accounts. When `branchId` is provided the caller must have
 * access to that branch and only teachers assigned to it are returned.
 */
export async function listTeachers(
  user: SafeUser,
  opts?: { branchId?: string; includeInactive?: boolean },
): Promise<TeacherRow[]> {
  let whereClause = "WHERE u.role = 'teacher'";
  const params: unknown[] = [];
  if (!opts?.includeInactive) {
    params.push(true);
    whereClause += ` AND u.active = $${params.length}`;
  }
  if (opts?.branchId) {
    await requireBranchAccess(user, opts.branchId);
    params.push(opts.branchId);
    whereClause += ` AND EXISTS (
      SELECT 1 FROM teacher_branch_assignments tba
      WHERE tba.teacher_user_id = u.id AND tba.branch_id = $${params.length}
    )`;
  }
  const db = await getDb();
  const teachers = await db.query(
    `SELECT u.id, u.email, u.name_ar, u.name_en, u.active, u.staff_id, u.created_at, u.updated_at
     FROM users u
     ${whereClause}
     ORDER BY u.name_ar ASC`,
    params,
  );
  // Enrich each teacher with all their branch memberships.
  const ids = teachers.rows.map((r) => String(r.id));
  const branchMap = new Map<string, string[]>();
  if (ids.length > 0) {
    const groups = await db.query(
      `SELECT teacher_user_id, branch_id FROM teacher_branch_assignments
       WHERE teacher_user_id = ANY($1) ORDER BY assigned_at ASC`,
      [ids],
    );
    for (const row of groups.rows) {
      const tid = String(row.teacher_user_id);
      const list = branchMap.get(tid) ?? [];
      if (!list.includes(String(row.branch_id))) list.push(String(row.branch_id));
      branchMap.set(tid, list);
    }
  }
  return teachers.rows.map((row) => toTeacherRow(row, branchMap.get(String(row.id)) ?? []));
}

/** Fetches one teacher with branch memberships and teaching assignments. */
export async function getTeacher(
  teacherUserId: string,
  user: SafeUser,
): Promise<TeacherRow & { teachingAssignments: TeachingAssignmentRow[] }> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT id, email, name_ar, name_en, active, staff_id, created_at, updated_at
     FROM users WHERE id = $1 AND role = 'teacher'`,
    [teacherUserId],
  );
  if (rows.rows.length === 0) {
    throw new ApiError("الأستاذ غير موجود", 404);
  }
  const row = rows.rows[0];
  const branches = await db.query(
    "SELECT branch_id FROM teacher_branch_assignments WHERE teacher_user_id = $1 ORDER BY assigned_at ASC",
    [teacherUserId],
  );

  // Prune both branch memberships and teaching assignments to the requester's
  // branch scope. super_admin has "ALL"; every other user only sees branches
  // they are authorized for, even though the teacher may span more branches.
  const scope = await getUserBranchScope(user);
  const branchIds = isAllScope(scope) ? toBranchIds(branches.rows) : toBranchIds(branches.rows).filter((id) => hasBranchAccess(scope, id));
  const visible = await listTeachingAssignments(user, { teacherUserId });
  const teaching = isAllScope(scope)
    ? visible
    : visible.filter((ta) => ta.branchId === undefined || hasBranchAccess(scope, ta.branchId));
  return { ...toTeacherRow(row, branchIds), teachingAssignments: teaching };
}