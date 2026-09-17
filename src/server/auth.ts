/**
 * Server-side auth service: password hashing (bcrypt), session management,
 * user CRUD with last-super-admin protection, and audit logging.
 *
 * Server-only module — never import from client code.
 */
import { createHash, randomBytes } from "node:crypto";
import { compareSync, hashSync } from "bcryptjs";
import { getDb, type DbRow } from "./db";
import { ApiError, readCookie, SESSION_COOKIE, sessionDurationSeconds } from "./http";
import { parseDuties, ROLE_LABELS, type Role, type SafeUser, type StaffDuty, type User } from "@/lib/auth/types";

const COST = 10;

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
}

export function hashPassword(password: string): string {
  return hashSync(password, COST);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

/** Validates that a role is one of the supported application roles. */
export function assertValidRole(role: unknown): asserts role is Role {
  if (typeof role !== "string" || !(role in ROLE_LABELS)) {
    throw new ApiError("دور غير صالح. الأدوار المقبولة: super_admin, staff, teacher, student");
  }
}

export function toSafeUser(row: DbRow): SafeUser {
  return {
    id: String(row.id),
    email: String(row.email),
    nameAr: String(row.name_ar),
    nameEn: String(row.name_en ?? ""),
    role: row.role as Role,
    active: Boolean(row.active),
    staffId: row.staff_id ? String(row.staff_id) : undefined,
    studentId: row.student_id ? String(row.student_id) : undefined,
    duties: parseDuties(row.duties ? String(row.duties) : ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toUserWithPassword(row: DbRow): User & { passwordHash: string } {
  return {
    id: String(row.id),
    email: String(row.email),
    nameAr: String(row.name_ar),
    nameEn: String(row.name_en ?? ""),
    role: row.role as Role,
    passwordHash: String(row.password_hash),
    active: Boolean(row.active),
    staffId: row.staff_id ? String(row.staff_id) : undefined,
    studentId: row.student_id ? String(row.student_id) : undefined,
    duties: parseDuties(row.duties ? String(row.duties) : ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function sessionDurationMillis(): number {
  return sessionDurationSeconds() * 1000;
}

function sessionExpiry(): Date {
  return new Date(Date.now() + sessionDurationMillis());
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSessionToken(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = sessionExpiry().toISOString();
  await (
    await getDb()
  ).query(
    "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)",
    [uid("ses"), userId, hashToken(token), new Date().toISOString(), expiresAt],
  );
  return { token, expiresAt };
}

export async function getSafeUserBySessionToken(token: string | null): Promise<SafeUser | null> {
  if (!token) return null;
  const result = await (
    await getDb()
  ).query(
    `SELECT u.id, u.email, u.name_ar, u.name_en, u.role, u.active, u.staff_id, u.student_id, u.duties, u.created_at, u.updated_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2 AND u.active = true
     LIMIT 1`,
    [hashToken(token), new Date().toISOString()],
  );
  return result.rows[0] ? toSafeUser(result.rows[0]) : null;
}

export async function deleteSessionByToken(token: string | null): Promise<void> {
  if (!token) return;
  await (await getDb()).query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await (await getDb()).query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export async function getSafeUserFromRequest(request: Request): Promise<SafeUser | null> {
  return getSafeUserBySessionToken(readCookie(request, SESSION_COOKIE));
}

export async function requireUserFromRequest(request: Request): Promise<SafeUser> {
  const user = await getSafeUserFromRequest(request);
  if (!user) {
    throw new ApiError("يجب تسجيل الدخول للوصول إلى هذا المورد", 401);
  }
  return user;
}

export async function requireAdminFromRequest(request: Request): Promise<SafeUser> {
  const user = await requireUserFromRequest(request);
  if (user.role !== "super_admin") {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب صلاحيات مدير النظام", 403);
  }
  return user;
}

export async function requireDeskFromRequest(request: Request): Promise<SafeUser> {
  const user = await requireUserFromRequest(request);
  if (user.role !== "super_admin" && user.role !== "staff") {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب صلاحية الإدارة أو الموظف", 403);
  }
  return user;
}

/**
 * Allows super admins and registrar staff to manage the school document and
 * create bound student logins (never full user management).
 */
export async function requireRegistrarOrAdminFromRequest(request: Request): Promise<SafeUser> {
  const user = await requireDeskFromRequest(request);
  if (user.role !== "super_admin" && !user.duties.includes("registrar")) {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب مدير النظام أو أمين السجل", 403);
  }
  return user;
}

export async function requireTeacherFromRequest(request: Request): Promise<SafeUser> {
  const user = await requireUserFromRequest(request);
  if (user.role !== "teacher") {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب حسابات الأساتذة فقط", 403);
  }
  return user;
}

export async function requireStudentFromRequest(request: Request): Promise<SafeUser> {
  const user = await requireUserFromRequest(request);
  if (user.role !== "student") {
    throw new ApiError("غير مصرح لك — هذه العملية تتطلب حسابات الطلاب فقط", 403);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type CreateUserInput = {
  email: string;
  nameAr: string;
  nameEn: string;
  role: Role;
  active: boolean;
  initialPassword: string;
  /** Optional link to a Staff record (teacher accounts). */
  staffId?: string | null;
  /** Optional link to a Student record (student accounts). */
  studentId?: string | null;
  /** Staff duties (ignored for non-staff roles). */
  duties?: StaffDuty[];
};

export type UpdateUserInput = {
  email?: string;
  nameAr?: string;
  nameEn?: string;
  role?: Role;
  active?: boolean;
  password?: string;
  /** `null` clears the link. */
  staffId?: string | null;
  /** `null` clears the link. */
  studentId?: string | null;
  /** Staff duties (non-staff roles always cleared). */
  duties?: StaffDuty[] | null;
};

export async function listUsersSafe(): Promise<SafeUser[]> {
  const result = await (
    await getDb()
  ).query(
    "SELECT id, email, name_ar, name_en, role, active, staff_id, student_id, duties, created_at, updated_at FROM users ORDER BY created_at ASC",
  );
  return result.rows.map(toSafeUser);
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const result = await (
    await getDb()
  ).query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email.trim().toLowerCase()],
  );
  return result.rows[0] ? toUserWithPassword(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<(User & { passwordHash: string }) | null> {
  const result = await (
    await getDb()
  ).query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ? toUserWithPassword(result.rows[0]) : null;
}

async function countActiveSuperAdmins(): Promise<number> {
  const result = await (
    await getDb()
  ).query("SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin' AND active = true");
  return Number(result.rows[0]?.count ?? 0);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginUser(email: string, password: string): Promise<SafeUser> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError("لا يوجد حساب بهذا البريد الإلكتروني", 401);
  }
  if (!user.active) {
    throw new ApiError("تم تعطيل هذا الحساب. تواصل مع مدير النظام.", 403);
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new ApiError("كلمة المرور غير صحيحة", 401);
  }
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

export async function createUserServer(input: CreateUserInput, actor: SafeUser): Promise<SafeUser> {
  assertValidRole(input.role);
  const db = await getDb();
  const email = normalizeEmail(input.email);
  if (!email || !input.nameAr.trim()) {
    throw new ApiError("يرجى ملء الاسم والبريد الإلكتروني");
  }
  const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    throw new ApiError("يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل");
  }
  if (!input.initialPassword || input.initialPassword.length < 6) {
    throw new ApiError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
  }

  const now = new Date().toISOString();
  const dutiesCsv = input.role === "staff" ? (input.duties ?? []).join(",") : "";
  const user = {
    id: uid("usr"),
    email,
    nameAr: input.nameAr.trim(),
    nameEn: input.nameEn.trim() || input.nameAr.trim(),
    role: input.role,
    passwordHash: hashPassword(input.initialPassword),
    active: input.active,
    staffId: input.role === "teacher" ? (input.staffId ?? null) : null,
    studentId: input.role === "student" ? (input.studentId ?? null) : null,
    dutiesCsv,
    createdAt: now,
    updatedAt: now,
  };
  await db.query(
    `INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, staff_id, student_id, duties, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [user.id, user.email, user.nameAr, user.nameEn, user.role, user.passwordHash, user.active, user.staffId, user.studentId, dutiesCsv, now],
  );
  await writeAudit({
    action: "user.create",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: user.id,
    targetName: user.nameAr,
    detail: `created ${user.role} account for ${user.email}`,
  });
  return toSafeUser({
    id: user.id,
    email: user.email,
    name_ar: user.nameAr,
    name_en: user.nameEn,
    role: user.role,
    active: user.active,
    staff_id: user.staffId,
    student_id: user.studentId,
    duties: dutiesCsv,
    created_at: now,
    updated_at: now,
  });
}

// ---------------------------------------------------------------------------
// Bound student logins (registrar workspace)
// ---------------------------------------------------------------------------

export const DEFAULT_STUDENT_PASSWORD = "Student2026!";

/**
 * Best-effort Arabic → Latin transliteration used to derive a deterministic
 * student username when no Latin (French) name is available.
 */
const ARABIC_LATIN: Record<string, string> = {
  "أ": "a", "إ": "a", "ا": "a", "آ": "a", "ب": "b", "ت": "t", "ث": "th",
  "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ي": "y", "ى": "a", "ة": "a", "ء": "",
};

/** Strips tashkeel/diacritics then maps Arabic letters to Latin. */
export function transliterateArabicName(name: string): string {
  const stripped = name.replace(/[\u064B-\u0652\u0670\u0640]/g, "");
  let out = "";
  for (const ch of stripped) {
    out += ARABIC_LATIN[ch] ?? ch;
  }
  return out;
}

/**
 * Deterministic username from a student's name (e.g. "Ahmed Mohamed Ali" →
 * `ahmed.ali`). Uses the Latin/French name when available, otherwise a
 * transliteration of the Arabic name. Letters/digits are normalized to ASCII,
 * spaces/separators to a single dot.
 */
export function generateStudentUsername(nameEn: string, nameAr: string): string {
  const source = nameEn.trim() || transliterateArabicName(nameAr);
  const parts = source
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let base = "student";
  if (parts.length === 1) {
    base = parts[0] ?? "";
  } else if (parts.length >= 2) {
    base = `${parts[0]}.${parts[parts.length - 1]}`;
  }
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  return base.slice(0, 40) || "student";
}

/** Finds the first free `{username}@madjd.local` login id (collision-safe). */
export async function uniqueStudentLoginId(nameEn: string, nameAr: string): Promise<string> {
  const db = await getDb();
  const stem = generateStudentUsername(nameEn, nameAr);
  let candidate = stem;
  let n = 2;
  for (;;) {
    const email = `${candidate}@madjd.local`;
    const clash = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (clash.rows.length === 0) return email;
    candidate = `${stem}${n++}`;
  }
}

/**
 * Unique, human-readable generated password for a fresh student account.
 * Uses a distraction-free alphabet (no 0/1/O/I/L) — 9 characters.
 */
export function generateStudentPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(9);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

/**
 * Builds the generated portal login id for a student record when the
 * registrar does not provide a personal email. Kept for legacy generated
 * logins (`s-abc123@madjd.local`) — new logins use name-based usernames.
 */
export function studentLoginId(studentId: string): string {
  return `s-${studentId}@madjd.local`;
}

export type StudentLoginInput = {
  nameAr: string;
  nameEn?: string;
  /** Optional personal email; when omitted a generated login id is used. */
  email?: string;
  /** Optional new password; preserved when omitted for an existing login. */
  initialPassword?: string;
  studentId: string;
  active?: boolean;
};

export type StudentLoginResult = {
  user: SafeUser;
  /** The effective login id (email) for the student portal. */
  email: string;
  /** Effective password only when it was just created or reset; "" otherwise. */
  password: string;
  /** true when a brand-new bound login was created. */
  created: boolean;
};

/**
 * Idempotent bound-student login used by the registrar workspace: creating a
 * student record in the school document is enough for that student to access
 * the portal. When a bound login already exists its profile is refreshed;
 * custom email/password changes are applied when explicitly provided.
 */
export async function upsertStudentUserServer(input: StudentLoginInput, actor: SafeUser): Promise<StudentLoginResult> {
  const db = await getDb();
  if (!input.studentId?.trim() || !input.nameAr.trim()) {
    throw new ApiError("بيانات الطالب غير مكتملة", 400);
  }

  const studentId = input.studentId.trim();
  const requestedPassword = input.initialPassword && input.initialPassword.length >= 6 ? input.initialPassword : "";
  const now = new Date().toISOString();

  const existing = await db.query("SELECT * FROM users WHERE student_id = $1 LIMIT 1", [studentId]);
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const id = String(row.id);
    const currentEmail = String(row.email);
    const requestedEmail = input.email?.trim() ? normalizeEmail(input.email) : currentEmail;
    if (requestedEmail !== currentEmail) {
      const clash = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [requestedEmail, id]);
      if (clash.rows.length > 0) {
        throw new ApiError("يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل");
      }
    }
    const nextNameAr = input.nameAr.trim();
    const nextNameEn = input.nameEn?.trim() || String(row.name_en ?? "") || nextNameAr;
    await db.query(
      "UPDATE users SET email = $1, name_ar = $2, name_en = $3, active = $4, updated_at = $5 WHERE id = $6",
      [requestedEmail, nextNameAr, nextNameEn, input.active ?? true, now, id],
    );
    if (requestedPassword) {
      await db.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [hashPassword(requestedPassword), now, id]);
      await writeAudit({
        action: "user.reset_password",
        actorId: actor.id,
        actorName: actor.nameAr,
        targetId: id,
        targetName: nextNameAr,
        detail: "password reset via registrar student login",
      });
    }
    const freshRows = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    return { user: toSafeUser(freshRows.rows[0]), email: requestedEmail, password: requestedPassword, created: false };
  }

  const email = input.email?.trim()
    ? normalizeEmail(input.email)
    : await uniqueStudentLoginId(input.nameEn ?? "", input.nameAr);
  const existingEmail = await db.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingEmail.rows.length > 0) {
    throw new ApiError("يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل");
  }

  // Every new student gets a unique generated password — never a shared default.
  const password = requestedPassword || generateStudentPassword();
  const id = uid("usr");
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn?.trim() || nameAr;
  await db.query(
    `INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, student_id, duties, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', $9, $9)`,
    [id, email, nameAr, nameEn, "student", hashPassword(password), input.active ?? true, studentId, now],
  );
  await writeAudit({
    action: "student.register",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: nameAr,
    detail: `student registered with login ${email}`,
  });
  const safe = toSafeUser({
    id,
    email,
    name_ar: nameAr,
    name_en: nameEn,
    role: "student",
    active: input.active ?? true,
    student_id: studentId,
    duties: "",
    created_at: now,
    updated_at: now,
  });
  return { user: safe, email: safe.email, password, created: true };
}

export async function updateUserServer(id: string, updates: UpdateUserInput, actor: SafeUser): Promise<SafeUser> {
  const db = await getDb();
  const current = await findUserById(id);
  if (!current) {
    throw new ApiError("الحساب غير موجود", 404);
  }
  if (updates.role !== undefined) assertValidRole(updates.role);

  const nextRole = updates.role ?? current.role;
  const nextActive = updates.active !== undefined ? updates.active : current.active;

  // Protect the last active super_admin from demotion, disable or (handled in delete) removal.
  if (current.role === "super_admin" && (updates.role !== undefined || updates.active !== undefined)) {
    const activeAdmins = await countActiveSuperAdmins();
    if (activeAdmins === 1) {
      if (nextRole !== "super_admin") {
        throw new ApiError("لا يمكن إلغاء دور مدير النظام الأخير");
      }
      if (!nextActive) {
        throw new ApiError("لا يمكن تعطيل مدير النظام الأخير");
      }
    }
  }

  const email = updates.email !== undefined ? normalizeEmail(updates.email) : current.email;
  if (email !== current.email) {
    const existing = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
    if (existing.rows.length > 0) {
      throw new ApiError("يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل");
    }
  }

  const now = new Date().toISOString();
  const nameAr = updates.nameAr !== undefined ? updates.nameAr.trim() || current.nameAr : current.nameAr;
  const nameEn = updates.nameEn !== undefined ? updates.nameEn.trim() || current.nameEn : current.nameEn;

  // Preserve existing links unless caller explicitly sends a value; clear links if the role changes.
  let nextStaffId = current.staffId ?? null;
  let nextStudentId = current.studentId ?? null;
  if (updates.role !== undefined && updates.role !== current.role) {
    nextStaffId = null;
    nextStudentId = null;
  }
  if ("staffId" in updates) nextStaffId = updates.staffId === undefined ? nextStaffId : updates.staffId;
  if ("studentId" in updates) nextStudentId = updates.studentId === undefined ? nextStudentId : updates.studentId;
  // Auto-assign links only when creating a fresh account with explicit role.
  if (nextRole === "teacher" && !nextStaffId && updates.staffId) nextStaffId = updates.staffId;
  if (nextRole === "student" && !nextStudentId && updates.studentId) nextStudentId = updates.studentId;

  const updated = {
    ...current,
    email,
    nameAr,
    nameEn,
    role: nextRole,
    active: nextActive,
    staffId: nextRole === "teacher" ? nextStaffId : null,
    studentId: nextRole === "student" ? nextStudentId : null,
    dutiesCsv:
      nextRole === "staff"
        ? ("duties" in updates ? (updates.duties ?? []).join(",") : current.duties.join(","))
        : "",
    passwordHash: updates.password ? hashPassword(updates.password) : current.passwordHash,
    updatedAt: now,
  };

  await db.query(
    `UPDATE users SET email = $1, name_ar = $2, name_en = $3, role = $4, active = $5, password_hash = $6, staff_id = $7, student_id = $8, duties = $9, updated_at = $10
     WHERE id = $11`,
    [updated.email, updated.nameAr, updated.nameEn, updated.role, updated.active, updated.passwordHash, updated.staffId, updated.studentId, updated.dutiesCsv, now, id],
  );

  if (updates.password) {
    await deleteUserSessions(id);
    await writeAudit({
      action: "user.reset_password",
      actorId: actor.id,
      actorName: actor.nameAr,
      targetId: id,
      targetName: updated.nameAr,
      detail: "password reset by admin",
    });
  } else {
    let action: AuditAction;
    let detail: string;
    if (updates.role !== undefined && updates.role !== current.role) {
      action = "user.update";
      detail = `role changed to ${updated.role}`;
    } else if (updates.active !== undefined && updates.active !== current.active) {
      action = updates.active ? "user.enable" : "user.disable";
      detail = updates.active ? "account re-enabled" : "account disabled";
    } else {
      action = "user.update";
      detail = "updated account";
    }
    await writeAudit({
      action,
      actorId: actor.id,
      actorName: actor.nameAr,
      targetId: id,
      targetName: updated.nameAr,
      detail,
    });
  }

  return toSafeUser({
    id,
    email: updated.email,
    name_ar: updated.nameAr,
    name_en: updated.nameEn,
    role: updated.role,
    active: updated.active,
    staff_id: updated.staffId,
    student_id: updated.studentId,
    duties: updated.dutiesCsv,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
}

export async function resetUserPasswordServer(id: string, newPassword: string, actor: SafeUser): Promise<SafeUser> {
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
  }
  return updateUserServer(id, { password: newPassword }, actor);
}

export async function deleteUserServer(id: string, actor: SafeUser): Promise<SafeUser> {
  const db = await getDb();
  const user = await findUserById(id);
  if (!user) {
    throw new ApiError("الحساب غير موجود", 404);
  }
  if (user.role === "super_admin") {
    const activeAdmins = await countActiveSuperAdmins();
    if (activeAdmins === 1) {
      throw new ApiError("لا يمكن حذف مدير النظام الأخير");
    }
  }

  await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
  await db.query("DELETE FROM users WHERE id = $1", [id]);
  await writeAudit({
    action: "user.delete",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: id,
    targetName: user.nameAr,
    detail: "account deleted",
  });
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

/**
 * Deactivates the bound portal login when a student record is removed, so a
 * deleted student can no longer sign in. Idempotent — safe to re-call.
 */
export async function deactivateStudentUserServer(
  studentId: string,
  actor: SafeUser,
): Promise<{ disabled: boolean }> {
  const db = await getDb();
  const found = await db.query(
    `SELECT id, name_ar FROM users WHERE student_id = $1 AND role = 'student' LIMIT 1`,
    [studentId],
  );
  if (found.rows.length === 0) {
    return { disabled: false };
  }
  const row = found.rows[0] as { id: string; name_ar: string };
  await db.query("UPDATE users SET active = false, updated_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    row.id,
  ]);
  await deleteUserSessions(row.id);
  await writeAudit({
    action: "student.delete",
    actorId: actor.id,
    actorName: actor.nameAr,
    targetId: row.id,
    targetName: row.name_ar,
    detail: "student removed from records — portal login deactivated",
  });
  return { disabled: true };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.disable"
  | "user.enable"
  | "user.reset_password"
  | "user.delete"
  | "user.migrate"
  | "branch.create"
  | "branch.update"
  | "branch_head.assign"
  | "branch_head.remove"
  | "financial_officer.assign"
  | "financial_officer.remove"
  | "student.register"
  | "student.update"
  | "student.delete"
  | "student.transfer"
  | "student.promote"
  | "class.create"
  | "class.update"
  | "class.delete"
  | "class.transfer"
  | "subject.create"
  | "subject.update"
  | "subject.delete"
  | "teaching.assign"
  | "teaching.remove"
  | "assessment.create"
  | "grade.entry"
  | "term.create"
  | "term.update"
  | "term.delete"
  | "payment.add"
  | "warning.add"
  | "attendance.mark"
  | "expense.add"
  | "document.generate"
  | "bulletin.publish";

/** Writes an audit entry. Actor info must always come from the session — never the client. */
export async function writeAudit(entry: {
  action: AuditAction;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  branchId?: string;
  entityType?: string;
  detail?: string;
}): Promise<void> {
  await (
    await getDb()
  ).query(
    `INSERT INTO audit_logs (id, action, actor_id, actor_name, target_id, target_name, branch_id, entity_type, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      uid("al"),
      entry.action,
      entry.actorId,
      entry.actorName,
      entry.targetId ?? null,
      entry.targetName ?? null,
      entry.branchId ?? null,
      entry.entityType ?? "",
      entry.detail ?? null,
      new Date().toISOString(),
    ],
  );
}

export async function listAuditLogs(limit = 200, branchId?: string): Promise<Array<Record<string, unknown>>> {
  const params: unknown[] = [];
  let where = "";
  if (branchId) {
    params.push(branchId);
    where = ` WHERE branch_id = $${params.length}`;
  }
  params.push(Math.min(Math.max(limit, 1), 500));
  const result = await (
    await getDb()
  ).query(
    `SELECT id, action, actor_id, actor_name, target_id, target_name, branch_id, entity_type, detail, created_at
     FROM audit_logs${where}
     ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
    params,
  );
  return result.rows.map((row) => ({
    id: String(row.id ?? ""),
    action: String(row.action),
    actorId: String(row.actor_id ?? ""),
    actorName: String(row.actor_name ?? ""),
    targetId: String(row.target_id ?? ""),
    targetName: String(row.target_name ?? ""),
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    entityType: String(row.entity_type ?? ""),
    detail: String(row.detail ?? ""),
    createdAt: String(row.created_at),
  }));
}

// ---------------------------------------------------------------------------
// School document
// ---------------------------------------------------------------------------

export type ServerSchoolDocument = {
  schemaVersion: number;
  document: Record<string, unknown>;
  updatedAt: string;
};

export async function getSchoolDocumentRow(): Promise<ServerSchoolDocument | null> {
  const result = await (await getDb()).query("SELECT schema_version, document, updated_at FROM school_documents WHERE id = 'main'");
  const row = result.rows[0];
  if (!row) return null;
  return {
    schemaVersion: Number(row.schema_version),
    document: JSON.parse(String(row.document)) as Record<string, unknown>,
    updatedAt: String(row.updated_at),
  };
}

export async function saveSchoolDocumentRow(document: unknown, schemaVersion: number): Promise<void> {
  if (typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion)) {
    throw new ApiError("إصدار المخطط (schemaVersion) غير صالح");
  }
  await (
    await getDb()
  ).query(
    `INSERT INTO school_documents (id, schema_version, document, updated_at)
     VALUES ('main', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET schema_version = $1, document = $2, updated_at = $3`,
    [Math.floor(schemaVersion), JSON.stringify(document), new Date().toISOString()],
  );
}