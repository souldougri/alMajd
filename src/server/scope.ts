/**
 * Server-side branch-scope authorization layer (Phase 2A).
 *
 * A user's accessible branches are ALWAYS derived from the assignment tables —
 * users carry no branch column. super_admin is global. Every data route must
 * validate through these helpers before reading or writing branch-scoped data.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import type { SafeUser } from "@/lib/auth/types";

/** `ALL` means unrestricted (super_admin). */
export type BranchScope = string[] | "ALL";

export function isAllScope(scope: BranchScope): scope is "ALL" {
  return scope === "ALL";
}

export function hasBranchAccess(scope: BranchScope, branchId: string): boolean {
  return isAllScope(scope) || scope.includes(branchId);
}

/**
 * Returns the set of branches the user may operate on. Membership is the
 * union of every assignment table:
 *   - user_branch_assignments        (employees)
 *   - teacher_branch_assignments     (teachers)
 *   - branch_heads (active)          (branch heads)
 *   - branch_financial_officers      (financial officers)
 *   - students.branch_id             (students, their current record branch)
 */
export async function getUserBranchScope(user: SafeUser): Promise<BranchScope> {
  if (user.role === "super_admin") return "ALL";
  if (user.role === "student") {
    if (!user.studentId) return [];
    const result = await (
      await getDb()
    ).query("SELECT branch_id FROM students WHERE id = $1 AND active = true LIMIT 1", [user.studentId]);
    return result.rows[0] ? [String(result.rows[0].branch_id)] : [];
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT DISTINCT branch_id FROM (
       SELECT branch_id FROM user_branch_assignments WHERE user_id = $1
       UNION ALL
       SELECT branch_id FROM teacher_branch_assignments WHERE teacher_user_id = $1
       UNION ALL
       SELECT branch_id FROM branch_heads WHERE user_id = $1 AND active = true
       UNION ALL
       SELECT branch_id FROM branch_financial_officers WHERE financial_officer_user_id = $1
     ) s ORDER BY branch_id`,
    [user.id],
  );
  return result.rows.map((row) => String(row.branch_id));
}

/** Throws 403 when the user cannot operate on the given branch. */
export async function requireBranchAccess(user: SafeUser, branchId: string): Promise<void> {
  const scope = await getUserBranchScope(user);
  if (!hasBranchAccess(scope, branchId)) {
    throw new ApiError("غير مصرح لك للوصول إلى هذا الفرع", 403);
  }
}

/**
 * Throws 403 unless the given branch is inside the user's scope and the user
 * is either super_admin or the acting Branch Head of that branch.
 */
export async function requireBranchHeadOrAdmin(user: SafeUser, branchId: string): Promise<void> {
  await requireBranchAccess(user, branchId);
  if (user.role === "super_admin") return;
  const result = await (
    await getDb()
  ).query(
    "SELECT id FROM branch_heads WHERE user_id = $1 AND branch_id = $2 AND active = true LIMIT 1",
    [user.id, branchId],
  );
  if (result.rows.length === 0) {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب صلاحيات مدير الفرع", 403);
  }
}

/**
 * Throws 403 unless the user is super_admin or the acting Financial Officer
 * covering the given branch.
 */
export async function requireFinancialOfficerOrAdmin(user: SafeUser, branchId: string): Promise<void> {
  await requireBranchAccess(user, branchId);
  if (user.role === "super_admin") return;
  const result = await (
    await getDb()
  ).query(
    "SELECT branch_id FROM branch_financial_officers WHERE branch_id = $1 AND financial_officer_user_id = $2",
    [branchId, user.id],
  );
  if (result.rows.length === 0) {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب صلاحية المسؤول المالي", 403);
  }
}

/** Convenience: resolves a branchId from a route/search param, rejecting empty. */
export function requireBranchId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("معرّف الفرع مفقود", 400);
  }
  return value.trim();
}

export type BranchRow = {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  address: string;
  phone: string;
  active: boolean;
  isDefault: boolean;
};

export function toBranch(row: DbRow): BranchRow {
  return {
    id: String(row.id),
    nameAr: String(row.name_ar),
    nameFr: String(row.name_fr ?? ""),
    nameEn: String(row.name_en ?? ""),
    address: String(row.address ?? ""),
    phone: String(row.phone ?? ""),
    active: Boolean(row.active),
    isDefault: Boolean(row.is_default),
  };
}

/** Lists branches the user can see, ordered by creation. */
export async function listBranchesForUser(user: SafeUser): Promise<BranchRow[]> {
  const scope = await getUserBranchScope(user);
  const result = await (
    await getDb()
  ).query(
    `SELECT id, name_ar, name_fr, name_en, address, phone, active, is_default
     FROM branches ORDER BY created_at ASC`,
  );
  const rows = result.rows.map(toBranch);
  if (isAllScope(scope)) return rows;
  const allowed = new Set(scope);
  return rows.filter((b) => allowed.has(b.id));
}

/** Returns the default/main branch, or the first active branch as fallback. */
export async function getDefaultBranchId(): Promise<string | null> {
  const result = await (
    await getDb()
  ).query(
    "SELECT id FROM branches WHERE active = true ORDER BY is_default DESC, created_at ASC LIMIT 1",
  );
  return result.rows[0] ? String(result.rows[0].id) : null;
}