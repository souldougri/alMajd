/**
 * Finance: fee types, payments and expenses (Phase 2A). All reads/writes are
 * branch-scoped: fee types/payments/expenses carry an explicit branch_id and
 * the actor must have branch access to it. Payments additionally validate the
 * student's current branch matches the payment branch.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { getUserBranchScope, isAllScope, requireBranchAccess } from "./scope";
import { uid, writeAudit } from "./auth";
import type { SafeUser } from "@/lib/auth/types";

export type FeeTypeRow = {
  id: string;
  branchId: string;
  branchNameAr: string;
  nameAr: string;
  amount: number;
  active: boolean;
};

export type PaymentRow = {
  id: string;
  studentId: string;
  studentNameAr: string;
  branchId: string;
  branchNameAr: string;
  amount: number;
  date: string;
  note: string;
  recordedByName: string;
};

export type ExpenseRow = {
  id: string;
  branchId: string;
  branchNameAr: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  vendor: string;
  recordedByName: string;
};

function toFeeType(row: DbRow): FeeTypeRow {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : "",
    nameAr: String(row.name_ar),
    amount: Number(row.amount ?? 0),
    active: Boolean(row.active),
  };
}

function toPayment(row: DbRow): PaymentRow {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    studentNameAr: row.student_name_ar ? String(row.student_name_ar) : "",
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : "",
    amount: Number(row.amount ?? 0),
    date: String(row.date),
    note: String(row.note ?? ""),
    recordedByName: row.recorded_by_name ? String(row.recorded_by_name) : "",
  };
}

function toExpense(row: DbRow): ExpenseRow {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    branchNameAr: row.branch_name_ar ? String(row.branch_name_ar) : "",
    date: String(row.date),
    category: String(row.category ?? ""),
    amount: Number(row.amount ?? 0),
    note: String(row.note ?? ""),
    vendor: String(row.vendor ?? ""),
    recordedByName: row.recorded_by_name ? String(row.recorded_by_name) : "",
  };
}

// ---------------------------------------------------------------------------
// Fee types
// ---------------------------------------------------------------------------

export async function listFeeTypes(
  actor: SafeUser,
  opts?: { branchId?: string; includeInactive?: boolean },
): Promise<FeeTypeRow[]> {
  const scope = await getUserBranchScope(actor);
  const params: unknown[] = [];
  let where = "1=1";
  if (!isAllScope(scope)) {
    params.push(scope);
    where += ` AND f.branch_id = ANY($${params.length}::text[])`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND f.branch_id = $${params.length}`;
  }
  if (!opts?.includeInactive) {
    where += " AND f.active = true";
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT f.id, f.branch_id, b.name_ar AS branch_name_ar, f.name_ar, f.amount, f.active
     FROM fee_types f JOIN branches b ON b.id = f.branch_id
     WHERE ${where}
     ORDER BY f.name_ar ASC, f.id ASC`,
    params,
  );
  return result.rows.map(toFeeType);
}

export async function createFeeType(
  actor: SafeUser,
  input: { id?: string; branchId: string; nameAr: string; amount: number },
): Promise<FeeTypeRow> {
  if (!input.branchId) throw new ApiError("معرّف الفرع مطلوب");
  const name = input.nameAr.trim();
  if (!name) throw new ApiError("اسم الرسوم مطلوب");
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new ApiError("مبلغ الرسوم غير صالح");
  }
  await requireBranchAccess(actor, input.branchId);
  const db = await getDb();
  const id = input.id?.trim() || uid("fee");
  await db.query(
    `INSERT INTO fee_types (id, branch_id, name_ar, amount, active) VALUES ($1, $2, $3, $4, true)`,
    [id, input.branchId, name, input.amount],
  );
  const result = await db.query(
    `SELECT f.id, f.branch_id, b.name_ar AS branch_name_ar, f.name_ar, f.amount, f.active
     FROM fee_types f JOIN branches b ON b.id = f.branch_id WHERE f.id = $1`,
    [id],
  );
  return toFeeType(result.rows[0]);
}

export async function updateFeeType(
  id: string,
  actor: SafeUser,
  input: { nameAr?: string; amount?: number; active?: boolean },
): Promise<FeeTypeRow> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id, name_ar, amount, active FROM fee_types WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("نوع الرسوم غير موجود", 404);
  const branchId = String(row.rows[0].branch_id);
  await requireBranchAccess(actor, branchId);

  const name = input.nameAr?.trim() ?? String(row.rows[0].name_ar);
  if (!name) throw new ApiError("اسم الرسوم مطلوب");
  const amount = input.amount !== undefined ? input.amount : Number(row.rows[0].amount);
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError("مبلغ الرسوم غير صالح");
  const active = input.active !== undefined ? input.active : Boolean(row.rows[0].active);

  await db.query("UPDATE fee_types SET name_ar = $1, amount = $2, active = $3 WHERE id = $4", [name, amount, active, id]);
  const result = await db.query(
    `SELECT f.id, f.branch_id, b.name_ar AS branch_name_ar, f.name_ar, f.amount, f.active
     FROM fee_types f JOIN branches b ON b.id = f.branch_id WHERE f.id = $1`,
    [id],
  );
  return toFeeType(result.rows[0]);
}

export async function removeFeeType(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id FROM fee_types WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("نوع الرسوم غير موجود", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM fee_types WHERE id = $1", [id]);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function listPayments(
  actor: SafeUser,
  opts?: { branchId?: string; studentId?: string },
): Promise<PaymentRow[]> {
  const scope = await getUserBranchScope(actor);
  const params: unknown[] = [];
  let where = "1=1";
  if (!isAllScope(scope)) {
    params.push(scope);
    where += ` AND p.branch_id = ANY($${params.length}::text[])`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND p.branch_id = $${params.length}`;
  }
  if (opts?.studentId) {
    params.push(opts.studentId);
    where += ` AND p.student_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT p.id, p.student_id, st.name_ar AS student_name_ar, p.branch_id, b.name_ar AS branch_name_ar,
            p.amount, p.date, p.note, COALESCE(u.name_ar, '') AS recorded_by_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN branches b ON b.id = p.branch_id
     LEFT JOIN users u ON u.id = p.recorded_by_user_id
     WHERE ${where}
     ORDER BY p.date DESC, p.id DESC`,
    params,
  );
  return result.rows.map(toPayment);
}

export async function createPayment(
  actor: SafeUser,
  input: { id?: string; studentId: string; branchId: string; amount: number; date: string; note?: string },
): Promise<PaymentRow> {
  if (!input.studentId || !input.branchId) throw new ApiError("بيانات الدفعة غير مكتملة");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new ApiError("مبلغ الدفعة غير صالح");
  if (!input.date) throw new ApiError("تاريخ الدفعة مطلوب");
  await requireBranchAccess(actor, input.branchId);

  const db = await getDb();
  const student = await db.query(
    "SELECT id, name_ar, branch_id FROM students WHERE id = $1 AND active = true",
    [input.studentId],
  );
  if (student.rows.length === 0) throw new ApiError("الطالب غير موجود", 404);
  const studentBranch = String(student.rows[0].branch_id);
  if (studentBranch !== input.branchId) {
    throw new ApiError("الطالب لا ينتمي إلى هذا الفرع");
  }

  const id = input.id?.trim() || uid("pay");
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO payments (id, student_id, branch_id, amount, date, note, recorded_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.studentId, input.branchId, input.amount, input.date, input.note ?? "", actor.id],
  );
  await writeAudit({
    action: "payment.add",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: String(student.rows[0].name_ar),
    branchId: input.branchId,
    entityType: "payment",
    detail: `دفعة ${input.amount} بتاريخ ${input.date}`,
  });

  const result = await db.query(
    `SELECT p.id, p.student_id, st.name_ar AS student_name_ar, p.branch_id, b.name_ar AS branch_name_ar,
            p.amount, p.date, p.note, COALESCE(u.name_ar, '') AS recorded_by_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     JOIN branches b ON b.id = p.branch_id
     LEFT JOIN users u ON u.id = p.recorded_by_user_id
     WHERE p.id = $1`,
    [id],
  );
  return toPayment(result.rows[0]);
}

export async function removePayment(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id FROM payments WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("الدفعة غير موجودة", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM payments WHERE id = $1", [id]);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(
  actor: SafeUser,
  opts?: { branchId?: string },
): Promise<ExpenseRow[]> {
  const scope = await getUserBranchScope(actor);
  const params: unknown[] = [];
  let where = "1=1";
  if (!isAllScope(scope)) {
    params.push(scope);
    where += ` AND e.branch_id = ANY($${params.length}::text[])`;
  }
  if (opts?.branchId) {
    params.push(opts.branchId);
    where += ` AND e.branch_id = $${params.length}`;
  }
  const result = await (
    await getDb()
  ).query(
    `SELECT e.id, e.branch_id, b.name_ar AS branch_name_ar, e.date, e.category, e.amount, e.note, e.vendor,
            COALESCE(u.name_ar, '') AS recorded_by_name
     FROM expenses e
     JOIN branches b ON b.id = e.branch_id
     LEFT JOIN users u ON u.id = e.recorded_by_user_id
     WHERE ${where}
     ORDER BY e.date DESC, e.id DESC`,
    params,
  );
  return result.rows.map(toExpense);
}

export async function createExpense(
  actor: SafeUser,
  input: { id?: string; branchId: string; date: string; category: string; amount: number; note?: string; vendor?: string },
): Promise<ExpenseRow> {
  if (!input.branchId) throw new ApiError("معرّف الفرع مطلوب");
  if (!input.date) throw new ApiError("تاريخ المصروف مطلوب");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new ApiError("مبلغ المصروف غير صالح");
  await requireBranchAccess(actor, input.branchId);

  const db = await getDb();
  const id = input.id?.trim() || uid("exp");
  await db.query(
    `INSERT INTO expenses (id, branch_id, date, category, amount, note, vendor, recorded_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, input.branchId, input.date, input.category ?? "", input.amount, input.note ?? "", input.vendor ?? "", actor.id],
  );
  await writeAudit({
    action: "expense.add",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: input.category || "مصروف",
    branchId: input.branchId,
    entityType: "expense",
    detail: `مصروف ${input.amount} بتاريخ ${input.date}`,
  });

  const result = await db.query(
    `SELECT e.id, e.branch_id, b.name_ar AS branch_name_ar, e.date, e.category, e.amount, e.note, e.vendor,
            COALESCE(u.name_ar, '') AS recorded_by_name
     FROM expenses e
     JOIN branches b ON b.id = e.branch_id
     LEFT JOIN users u ON u.id = e.recorded_by_user_id
     WHERE e.id = $1`,
    [id],
  );
  return toExpense(result.rows[0]);
}

export async function removeExpense(id: string, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const row = await db.query("SELECT id, branch_id FROM expenses WHERE id = $1", [id]);
  if (row.rows.length === 0) throw new ApiError("المصروف غير موجود", 404);
  await requireBranchAccess(actor, String(row.rows[0].branch_id));
  await db.query("DELETE FROM expenses WHERE id = $1", [id]);
}