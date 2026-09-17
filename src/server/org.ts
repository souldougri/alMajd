/**
 * Organization service (Phase 2A): branches, Branch Heads and Financial
 * Officers. Accounts, branches and organizational authority are managed
 * exclusively by the System Admin.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { uid, writeAudit } from "./auth";
import { ApiError } from "./http";
import { getDefaultBranchId, listBranchesForUser, requireBranchAccess, requireBranchId, toBranch, type BranchRow } from "./scope";
import type { SafeUser } from "@/lib/auth/types";

export type CreateBranchInput = {
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  address?: string;
  phone?: string;
};

export type UpdateBranchInput = {
  nameAr?: string;
  nameFr?: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  active?: boolean;
};

export type OrgAuthorityRow = {
  id: string;
  userId: string;
  userNameAr: string;
  userEmail: string;
  active: boolean;
  assignedAt: string;
  appointedBy?: string;
};

export { listBranchesForUser, getDefaultBranchId };

async function requireBranchIdExists(branchId: string): Promise<void> {
  const result = await (await getDb()).query("SELECT id FROM branches WHERE id = $1", [branchId]);
  if (result.rows.length === 0) {
    throw new ApiError("الفرع غير موجود", 404);
  }
}

export async function createBranch(input: CreateBranchInput, actor: SafeUser): Promise<BranchRow> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — إنشاء الفروع يتطلب صلاحيات مدير النظام", 403);
  }
  const nameAr = input.nameAr.trim();
  if (!nameAr) {
    throw new ApiError("يرجى إدخال اسم الفرع");
  }
  const db = await getDb();
  const clash = await db.query("SELECT id FROM branches WHERE name_ar = $1", [nameAr]);
  if (clash.rows.length > 0) {
    throw new ApiError("يوجد فرع بهذا الاسم بالفعل");
  }
  const now = new Date().toISOString();
  const id = uid("br");
  await db.query(
    `INSERT INTO branches (id, name_ar, name_fr, name_en, address, phone, active, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $7)`,
    [id, nameAr, input.nameFr?.trim() ?? "", input.nameEn?.trim() ?? "", input.address?.trim() ?? "", input.phone?.trim() ?? "", now],
  );
  await writeAudit({
    action: "branch.create",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: nameAr,
    detail: `created branch ${nameAr}`,
  });
  return toBranch({ id, name_ar: nameAr, name_fr: input.nameFr, name_en: input.nameEn, address: input.address, phone: input.phone, active: true, is_default: false });
}

export async function updateBranch(branchId: string, input: UpdateBranchInput, actor: SafeUser): Promise<BranchRow> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — تعديل الفروع يتطلب صلاحيات مدير النظام", 403);
  }
  const id = requireBranchId(branchId);
  await requireBranchIdExists(id);
  const db = await getDb();
  const current = await db.query(
    "SELECT id, name_ar, name_fr, name_en, address, phone, active, is_default FROM branches WHERE id = $1",
    [id],
  );
  const row = current.rows[0];
  const nameAr = (input.nameAr ?? "").trim() || String(row.name_ar);
  if (nameAr !== String(row.name_ar)) {
    const clash = await db.query("SELECT id FROM branches WHERE name_ar = $1 AND id != $2", [nameAr, id]);
    if (clash.rows.length > 0) {
      throw new ApiError("يوجد فرع بهذا الاسم بالفعل");
    }
  }
  const now = new Date().toISOString();
  await db.query(
    `UPDATE branches
     SET name_ar = $1, name_fr = $2, name_en = $3, address = $4, phone = $5,
         active = $6, updated_at = $7
     WHERE id = $8`,
    [
      nameAr,
      input.nameFr !== undefined ? input.nameFr.trim() : row.name_fr,
      input.nameEn !== undefined ? input.nameEn.trim() : row.name_en,
      input.address !== undefined ? input.address.trim() : row.address,
      input.phone !== undefined ? input.phone.trim() : row.phone,
      input.active !== undefined ? input.active : Boolean(row.active),
      now,
      id,
    ],
  );
  await writeAudit({
    action: "branch.update",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: nameAr,
    detail: "updated branch",
  });
  const fresh = await db.query(
    "SELECT id, name_ar, name_fr, name_en, address, phone, active, is_default FROM branches WHERE id = $1",
    [id],
  );
  return toBranch(fresh.rows[0]);
}

// ---------------------------------------------------------------------------
// Branch Heads (one active per branch, one active branch per user)
// ---------------------------------------------------------------------------

function toHeadRow(row: DbRow): OrgAuthorityRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userNameAr: String(row.user_name_ar ?? ""),
    userEmail: String(row.user_email ?? ""),
    active: Boolean(row.active),
    assignedAt: String(row.appointed_at),
    appointedBy: row.appointed_by ? String(row.appointed_by) : undefined,
  };
}

export async function listBranchHeads(): Promise<OrgAuthorityRow[]> {
  const result = await (
    await getDb()
  ).query(
    `SELECT bh.id, bh.branch_id, bh.user_id, u.name_ar AS user_name_ar, u.email AS user_email,
            bh.active, bh.appointed_at, bu.name_ar AS appointed_by
     FROM branch_heads bh
     JOIN users u ON u.id = bh.user_id
     LEFT JOIN users bu ON bu.id = bh.appointed_by_user_id
     ORDER BY bh.appointed_at DESC`,
  );
  return result.rows.map(toHeadRow);
}

/**
 * Appoints a Branch Head for the branch. Deactivates the previous active
 * head first (database constraints enforce one active head per branch and one
 * active branch per head).
 */
export async function assignBranchHead(branchId: string, userId: string, actor: SafeUser): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — تعيين مدير الفرع يتطلب صلاحيات مدير النظام", 403);
  }
  const bid = requireBranchId(branchId);
  const uid_ = requireBranchId(userId);
  await requireBranchIdExists(bid);
  const user = await (await getDb()).query("SELECT id, role, name_ar FROM users WHERE id = $1", [uid_]);
  if (user.rows.length === 0) {
    throw new ApiError("الحساب غير موجود", 404);
  }
  if (String(user.rows[0].role) !== "staff") {
    throw new ApiError("مدير الفرع يجب أن يكون حساب موظف (staff)", 400);
  }
  const db = await getDb();
  const now = new Date().toISOString();
  await db.query(
    `UPDATE branch_heads SET active = false, appointed_at = appointed_at
     WHERE branch_id = $1 AND active = true`,
    [bid],
  );
  const existing = await db.query(
    "SELECT id FROM branch_heads WHERE branch_id = $1 AND user_id = $2",
    [bid, uid_],
  );
  if (existing.rows.length > 0) {
    await db.query(
      "UPDATE branch_heads SET active = true, appointed_at = $1, appointed_by_user_id = $2 WHERE id = $3",
      [now, actor.id, existing.rows[0].id],
    );
  } else {
    await db.query(
      `INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_by_user_id, appointed_at)
       VALUES ($1, $2, $3, true, $4, $5)`,
      [uid("bh"), bid, uid_, actor.id, now],
    );
  }
  await writeAudit({
    action: "branch_head.assign",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: bid,
    targetName: String(user.rows[0].name_ar),
    detail: `appointed branch head for branch ${bid}`,
  });
}

/**
 * Returns the active Branch Head of a branch, or null when none is appointed.
 * Branch-scoped read: the caller must have access to the branch, so a
 * branch-scoped user can never see another branch's management data.
 */
export async function getBranchHead(branchId: string, user: SafeUser): Promise<(OrgAuthorityRow & { branchId: string }) | null> {
  const bid = requireBranchId(branchId);
  await requireBranchIdExists(bid);
  await requireBranchAccess(user, bid);
  const result = await (
    await getDb()
  ).query(
    `SELECT bh.id, bh.branch_id, bh.user_id, u.name_ar AS user_name_ar, u.email AS user_email,
            bh.active, bh.appointed_at, bu.name_ar AS appointed_by
     FROM branch_heads bh
     JOIN users u ON u.id = bh.user_id
     LEFT JOIN users bu ON bu.id = bh.appointed_by_user_id
     WHERE bh.branch_id = $1 AND bh.active = true
     ORDER BY bh.appointed_at DESC
     LIMIT 1`,
    [bid],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { ...toHeadRow(row), branchId: bid };
}

export async function removeBranchHead(branchId: string, actor: SafeUser): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — إلغاء مدير الفرع يتطلب صلاحيات مدير النظام", 403);
  }
  const bid = requireBranchId(branchId);
  await dbupdateActiveHead(bid, actor);
}

async function dbupdateActiveHead(bid: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const head = await db.query(
    "SELECT id, user_id, appointed_at FROM branch_heads WHERE branch_id = $1 AND active = true",
    [bid],
  );
  if (head.rows.length > 0) {
    await db.query("UPDATE branch_heads SET active = false WHERE id = $1", [head.rows[0].id]);
    const user = await db.query("SELECT name_ar FROM users WHERE id = $1", [head.rows[0].user_id]);
    await writeAudit({
      action: "branch_head.remove",
      actorId: actor.id,
      actorName: actor.nameAr,
      targetId: bid,
      targetName: String(user.rows[0]?.name_ar ?? ""),
      detail: "removed active branch head",
    });
  }
}

// ---------------------------------------------------------------------------
// Financial Officers (one primary per branch via PK; many branches per officer)
// ---------------------------------------------------------------------------

export async function listFinancialOfficers(): Promise<Array<OrgAuthorityRow & { branchId: string }>> {
  const result = await (
    await getDb()
  ).query(
    `SELECT bfo.branch_id, bfo.financial_officer_user_id AS user_id, U.name_ar AS user_name_ar,
            U.email AS user_email, bfo.status, bfo.assigned_at, bu.name_ar AS appointed_by,
            b.name_ar AS branch_name
     FROM branch_financial_officers bfo
     JOIN users U ON U.id = bfo.financial_officer_user_id
     JOIN branches b ON b.id = bfo.branch_id
     LEFT JOIN users bu ON bu.id = bfo.assigned_by_user_id
     ORDER BY bfo.assigned_at DESC`,
  );
  return result.rows.map((row) => ({
    id: String(row.branch_id),
    branchId: String(row.branch_id),
    branchName: String(row.branch_name ?? ""),
    userId: String(row.user_id),
    userNameAr: String(row.user_name_ar ?? ""),
    userEmail: String(row.user_email ?? ""),
    active: String(row.status) === "active",
    assignedAt: String(row.assigned_at),
    appointedBy: row.appointed_by ? String(row.appointed_by) : undefined,
  }));
}

/** Assigns/updates the sole (primary) Financial Officer covering a branch. */
export async function assignFinancialOfficer(branchId: string, userId: string, actor: SafeUser): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — تعيين المسؤول المالي يتطلب صلاحيات مدير النظام", 403);
  }
  const bid = requireBranchId(branchId);
  const uid_ = requireBranchId(userId);
  await requireBranchIdExists(bid);
  const user = await (await getDb()).query("SELECT id, role, name_ar FROM users WHERE id = $1", [uid_]);
  if (user.rows.length === 0) {
    throw new ApiError("الحساب غير موجود", 404);
  }
  const db = await getDb();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO branch_financial_officers (branch_id, financial_officer_user_id, status, assigned_by_user_id, assigned_at)
     VALUES ($1, $2, 'active', $3, $4)
     ON CONFLICT (branch_id) DO UPDATE
       SET financial_officer_user_id = EXCLUDED.financial_officer_user_id,
           status = 'active',
           assigned_by_user_id = EXCLUDED.assigned_by_user_id,
           assigned_at = EXCLUDED.assigned_at`,
    [bid, uid_, actor.id, now],
  );
  await writeAudit({
    action: "financial_officer.assign",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: bid,
    targetName: String(user.rows[0].name_ar),
    detail: `assigned financial officer for branch ${bid}`,
  });
}

/**
 * Returns the primary Financial Officer covering a branch, or null when none
 * is assigned. Same branch-scoped read rule as the Branch Head.
 */
export async function getBranchFinancialOfficer(
  branchId: string,
  user: SafeUser,
): Promise<(OrgAuthorityRow & { branchId: string; branchName?: string }) | null> {
  const bid = requireBranchId(branchId);
  await requireBranchIdExists(bid);
  await requireBranchAccess(user, bid);
  const result = await (
    await getDb()
  ).query(
    `SELECT bfo.branch_id, bfo.financial_officer_user_id AS user_id, U.name_ar AS user_name_ar,
            U.email AS user_email, bfo.status, bfo.assigned_at, bu.name_ar AS appointed_by,
            b.name_ar AS branch_name
     FROM branch_financial_officers bfo
     JOIN users U ON U.id = bfo.financial_officer_user_id
     JOIN branches b ON b.id = bfo.branch_id
     LEFT JOIN users bu ON bu.id = bfo.assigned_by_user_id
     WHERE bfo.branch_id = $1
     LIMIT 1`,
    [bid],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.branch_id),
    branchId: String(row.branch_id),
    branchName: String(row.branch_name ?? ""),
    userId: String(row.user_id),
    userNameAr: String(row.user_name_ar ?? ""),
    userEmail: String(row.user_email ?? ""),
    active: String(row.status) === "active",
    assignedAt: String(row.assigned_at),
    appointedBy: row.appointed_by ? String(row.appointed_by) : undefined,
  };
}

/** Removes the FO for one branch (branch keeps no officer until reassigned). */
export async function removeFinancialOfficer(branchId: string, actor: SafeUser): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — إلغاء المسؤول المالي يتطلب صلاحيات مدير النظام", 403);
  }
  const bid = requireBranchId(branchId);
  const db = await getDb();
  const row = await db.query(
    "SELECT financial_officer_user_id FROM branch_financial_officers WHERE branch_id = $1",
    [bid],
  );
  if (row.rows.length > 0) {
    await db.query("DELETE FROM branch_financial_officers WHERE branch_id = $1", [bid]);
    const user = await db.query("SELECT name_ar FROM users WHERE id = $1", [row.rows[0].financial_officer_user_id]);
    await writeAudit({
      action: "financial_officer.remove",
      actorId: actor.id,
      actorName: actor.nameAr,
      targetId: bid,
      targetName: String(user.rows[0]?.name_ar ?? ""),
      detail: "removed financial officer",
    });
  }
}