/**
 * Documents archive: uploads, visibility rules, download, archive/hide.
 *
 * Files are stored under `.data/uploads/docs/`; metadata lives in the
 * `documents` table. Server-only module — never import from client code.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { resolveParentStudentId, uid } from "./auth";
import { getUserBranchScope, hasBranchAccess, isAllScope } from "./scope";
import { DOCS_DIR, MAX_UPLOAD_BYTES, validateUpload } from "./uploads";
import type { SafeUser } from "@/lib/auth/types";

export type DocVisibility = "admin_only" | "staff" | "teachers" | "one_class" | "linked_student";
export type DocCategory = "إداري" | "طالب" | "تعليمي" | "أخرى";

const VISIBILITIES = new Set<string>(["admin_only", "staff", "teachers", "one_class", "linked_student"]);
const CATEGORIES = new Set<string>(["إداري", "طالب", "تعليمي", "أخرى"]);

export type StoredDocument = {
  id: string;
  title: string;
  category: DocCategory;
  visibility: DocVisibility;
  classId?: string;
  studentId?: string;
  branchId?: string;
  filename: string;
  storedName: string;
  sizeBytes: number;
  mime: string;
  uploadedByUserId: string;
  uploadedByName: string;
  archived: boolean;
  createdAt: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  category: DocCategory;
  visibility: DocVisibility;
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  branchId?: string;
  filename: string;
  sizeBytes: number;
  mime: string;
  uploadedByName: string;
  archived: boolean;
  createdAt: string;
  canManage: boolean;
};

function toStored(row: DbRow): StoredDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category) as DocCategory,
    visibility: String(row.visibility) as DocVisibility,
    classId: row.class_id ? String(row.class_id) : undefined,
    studentId: row.student_id ? String(row.student_id) : undefined,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    filename: String(row.filename),
    storedName: String(row.stored_name),
    sizeBytes: Number(row.size_bytes ?? 0),
    mime: String(row.mime),
    uploadedByUserId: String(row.uploaded_by_user_id),
    uploadedByName: String(row.uploaded_by_name ?? ""),
    archived: Boolean(row.archived),
    createdAt: String(row.created_at),
  };
}

function cleanStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type UploadInput = {
  title?: unknown;
  category?: unknown;
  visibility?: unknown;
  classId?: unknown;
  studentId?: unknown;
  branchId?: unknown;
  filename: string;
  mime: string;
  byteLength: number;
  bytes: Buffer;
};

/** Class ids assigned to a teacher account (head-teacher classes + teaching assignments). */
async function teacherClassIds(user: SafeUser): Promise<Set<string>> {
  const db = await getDb();
  const result = await db.query(
    `SELECT c.id FROM classes c WHERE c.head_teacher_user_id = $1 AND c.active = true
     UNION
     SELECT ta.class_id FROM teaching_assignments ta WHERE ta.teacher_user_id = $1`,
    [user.id],
  );
  return new Set(result.rows.map((r) => String(r.id)));
}

async function classMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const map = new Map<string, string>();
  const classes = await db.query("SELECT id, name_ar FROM classes");
  for (const c of classes.rows) map.set(String(c.id), String(c.name_ar ?? ""));
  const students = await db.query("SELECT id, name_ar FROM students");
  for (const s of students.rows) map.set(`student:${String(s.id)}`, String(s.name_ar ?? ""));
  return map;
}

async function classExists(classId: string): Promise<boolean> {
  const r = await (await getDb()).query("SELECT 1 FROM classes WHERE id = $1", [classId]);
  return r.rows.length > 0;
}

async function studentExists(studentId: string): Promise<boolean> {
  const r = await (await getDb()).query("SELECT 1 FROM students WHERE id = $1", [studentId]);
  return r.rows.length > 0;
}

/**
 * Resolves the branch a document belongs to. Preference order:
 * explicit branchId → the class's branch → the student's branch. Falls back to
 * null (legacy/global documents keep a null branch for backward compat).
 */
async function resolveDocumentBranch(input: {
  classId?: string;
  studentId?: string;
  branchId?: string;
}): Promise<string | null> {
  if (input.branchId) return input.branchId;
  const db = await getDb();
  if (input.classId) {
    const result = await db.query("SELECT branch_id FROM classes WHERE id = $1 LIMIT 1", [input.classId]);
    if (result.rows.length > 0) return String(result.rows[0].branch_id);
  }
  if (input.studentId) {
    const result = await db.query("SELECT branch_id FROM students WHERE id = $1 LIMIT 1", [input.studentId]);
    if (result.rows.length > 0) return String(result.rows[0].branch_id);
  }
  return null;
}

/** Throws unless the user may attach a document to the given branch. */
async function requireBranchOrGlobal(user: SafeUser, branchId: string | null): Promise<void> {
  const scope = await getUserBranchScope(user);
  if (isAllScope(scope)) return;
  if (branchId === null) return;
  if (!hasBranchAccess(scope, branchId)) {
    throw new ApiError("غير مصرح لك لرفع مستندات لهذا الفرع", 403);
  }
}

function assertAllowedVisibility(v: unknown): asserts v is DocVisibility {
  if (typeof v !== "string" || !VISIBILITIES.has(v)) {
    throw new ApiError("وجهة عرض المستند غير صالحة");
  }
}

function assertAllowedCategory(c: unknown): asserts c is DocCategory {
  if (typeof c !== "string" || !CATEGORIES.has(c)) {
    throw new ApiError("تصنيف المستند غير صالح");
  }
}

export async function createDocument(user: SafeUser, input: UploadInput): Promise<DocumentRow> {
  if (user.role === "student" || user.role === "parent") {
    throw new ApiError("حسابات الطلاب وأولياء الأمور لا يمكنها رفع مستندات", 403);
  }

  assertAllowedVisibility(input.visibility);
  assertAllowedCategory(input.category);
  const title = cleanStr(input.title);
  if (!title) throw new ApiError("عنوان المستند مطلوب");

  const { ext, mime } = validateUpload(input.filename, input.byteLength);
  const visibility = input.visibility;
  let classId: string | null = null;
  let studentId: string | null = null;

  if (user.role === "super_admin") {
    if (visibility === "one_class") {
      classId = cleanStr(input.classId);
      if (!classId) throw new ApiError("اختر الصف المستفيد من المستند");
      if (!(await classExists(classId))) throw new ApiError("الصف غير موجود");
    }
    if (visibility === "linked_student") {
      studentId = cleanStr(input.studentId);
      if (!studentId) throw new ApiError("اختر الطالب المرتبط بالمستند");
      if (!(await studentExists(studentId))) throw new ApiError("الطالب غير موجود");
    }
  } else if (user.role === "staff") {
    const duties = new Set(user.duties);
    if (duties.has("academic")) {
      if (visibility !== "one_class") {
        throw new ApiError("يمكن للشؤون الدراسية رفع ملفات تعليمية لفصل محدد فقط", 403);
      }
      if (input.category !== "تعليمي") {
        throw new ApiError("تصنيف ملفات الشؤون الدراسية يجب أن يكون تعليمي", 403);
      }
      classId = cleanStr(input.classId);
      if (!classId) throw new ApiError("اختر الصف المستفيد من الملف التعليمي");
      if (!(await classExists(classId))) throw new ApiError("الصف غير موجود");
    } else if (duties.has("registrar")) {
      if (visibility !== "linked_student") {
        throw new ApiError("يمكن لأمين السجل رفع ملفات على سجل طالب محدد فقط", 403);
      }
      if (input.category !== "طالب") {
        throw new ApiError("تصنيف ملفات أمين السجل يجب أن يكون من فئة طالب", 403);
      }
      studentId = cleanStr(input.studentId);
      if (!studentId) throw new ApiError("اختر الطالب المرتبط بالملف");
      if (!(await studentExists(studentId))) throw new ApiError("الطالب غير موجود");
    } else {
      throw new ApiError("لا يمكن لموظف بلا اختصاص (دراسي/أمين سجل) رفع مستندات", 403);
    }
  } else if (user.role === "teacher") {
    if (visibility !== "one_class") {
      throw new ApiError("يمكن للأستاذ رفع ملفات تعليمية لفصله الموكَل إليه فقط", 403);
    }
    if (input.category !== "تعليمي") {
      throw new ApiError("تصنيف ملفات الأستاذ يجب أن يكون تعليمي", 403);
    }
    classId = cleanStr(input.classId);
    if (!classId) throw new ApiError("اختر الصف المستفيد من الملف التعليمي");
    const assigned = await teacherClassIds(user);
    if (!assigned.has(classId)) throw new ApiError("هذا الفصل ليس من الفصول الموكلة إليك", 403);
  }

  const id = uid("doc");
  const storedName = `${id}${ext}`;
  const dir = DOCS_DIR;

  // Branch scope is resolved and enforced BEFORE anything touches the disk,
  // so a denied upload never leaves an orphan file behind.
  const resolvedBranchId = await resolveDocumentBranch({
    classId: classId ?? undefined,
    studentId: studentId ?? undefined,
    branchId: cleanStr(input.branchId) || undefined,
  });
  if (user.role !== "super_admin") {
    await requireBranchOrGlobal(user, resolvedBranchId);
  }

  await mkdir(dir, { recursive: true });

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(`حجم الملف يتجاوز الحد الأقصى المسموح (10 MB)`);
  }
  await writeFile(join(dir, storedName), input.bytes);

  const now = new Date().toISOString();
  try {
    await (
      await getDb()
    ).query(
      `INSERT INTO documents (id, title, category, visibility, class_id, student_id, branch_id, filename, stored_name, size_bytes, mime, uploaded_by_user_id, uploaded_by_name, archived, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        title,
        input.category,
        visibility,
        classId,
        studentId,
        resolvedBranchId,
        input.filename,
        storedName,
        input.byteLength,
        mime,
        user.id,
        user.nameAr,
        false,
        now,
      ],
    );
  } catch (err) {
    // The file was already written: remove it so a failed insert never
    // leaves an orphan file on disk without a metadata row.
    await unlink(join(dir, storedName)).catch(() => undefined);
    throw err;
  }

  const created = (await findDocument(id)) as StoredDocument;
  return enrichDocuments([created], user, await classMap())[0];
}

async function findDocument(id: string): Promise<StoredDocument | null> {
  const result = await (
    await getDb()
  ).query("SELECT * FROM documents WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ? toStored(result.rows[0]) : null;
}

/** True when the given account may see this document. */
export async function canSeeDocument(user: SafeUser, doc: StoredDocument): Promise<boolean> {
  if (user.role === "super_admin") return true;
  if (doc.archived) return false;
  if (doc.branchId) {
    const scope = await getUserBranchScope(user);
    if (!isAllScope(scope) && !scope.includes(doc.branchId)) return false;
  }

  switch (user.role) {
    case "staff":
      return (
        doc.visibility === "staff" ||
        (doc.visibility === "one_class" && Boolean(doc.classId)) ||
        (doc.visibility === "linked_student" && Boolean(doc.studentId))
      );
    case "teacher": {
      if (doc.visibility === "teachers") return true;
      if (doc.visibility === "one_class" && doc.classId) {
        const assigned = await teacherClassIds(user);
        return assigned.has(doc.classId);
      }
      return false;
    }
    case "student": {
      if (!user.studentId) return false;
      if (doc.visibility === "one_class" && doc.classId) {
        const enrolled = await (
          await getDb()
        ).query(
          "SELECT 1 FROM student_class_enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'enrolled' AND is_current = true LIMIT 1",
          [user.studentId, doc.classId],
        );
        return enrolled.rows.length > 0;
      }
      if (doc.visibility === "linked_student") return doc.studentId === user.studentId;
      return false;
    }
    default:
      return false;
  }
}

async function listAllStored(): Promise<StoredDocument[]> {
  const result = await (
    await getDb()
  ).query(
    "SELECT * FROM documents ORDER BY created_at DESC, id DESC",
  );
  return result.rows.map(toStored);
}

function enrichDocuments(list: StoredDocument[], user: SafeUser, names: Map<string, string>): DocumentRow[] {
  return list.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    visibility: d.visibility,
    classId: d.classId,
    className: d.classId ? names.get(d.classId) : undefined,
    studentId: d.studentId,
    studentName: d.studentId ? names.get(`student:${d.studentId}`) : undefined,
    branchId: d.branchId,
    filename: d.filename,
    sizeBytes: d.sizeBytes,
    mime: d.mime,
    uploadedByName: d.uploadedByName,
    archived: d.archived,
    createdAt: d.createdAt,
    canManage: user.role === "super_admin" || d.uploadedByUserId === user.id,
  }));
}

/**
 * Returns the documents visible to the account, with optional server-side
 * filtering to a single class, student or branch (used by workspace panels).
 * Branch scope is enforced in canSeeDocument for every account.
 */
export async function listDocumentsForUser(
  user: SafeUser,
  opts?: { classId?: string; studentId?: string; branchId?: string },
): Promise<DocumentRow[]> {
  const all = await listAllStored();
  const names = await classMap();
  const visible: StoredDocument[] = [];
  for (const d of all) {
    if (!(await canSeeDocument(user, d))) continue;
    if (opts?.classId && d.classId && d.classId !== opts.classId) continue;
    if (opts?.classId && !d.classId) continue;
    if (opts?.studentId && d.studentId && d.studentId !== opts.studentId) continue;
    if (opts?.branchId && d.branchId && d.branchId !== opts.branchId) continue;
    visible.push(d);
  }
  return enrichDocuments(visible, user, names);
}

/** Archive (hide) or unarchive a document. */
export async function setDocumentArchived(
  user: SafeUser,
  id: string,
  archived: boolean,
): Promise<DocumentRow> {
  const doc = await findDocument(id);
  if (!doc) throw new ApiError("المستند غير موجود", 404);
  if (user.role !== "super_admin" && doc.uploadedByUserId !== user.id) {
    throw new ApiError("لا يمكنك تعديل هذا المستند", 403);
  }
  if (user.role !== "super_admin" && !archived) {
    throw new ApiError("لا يمكن إعادة إظهار مستند مؤرشف — تواصل مع مدير النظام", 403);
  }
  await (await getDb()).query("UPDATE documents SET archived = $1 WHERE id = $2", [archived, id]);
  const updated = (await findDocument(id)) as StoredDocument;
  return enrichDocuments([updated], user, await classMap())[0];
}

export type DownloadResult = { buffer: Buffer; filename: string; mime: string };

/** Prepares the file bytes for download; enforces the same visibility rules. */
export async function downloadDocument(user: SafeUser, id: string): Promise<DownloadResult> {
  const doc = await findDocument(id);
  if (!doc) throw new ApiError("المستند غير موجود", 404);
  if (!(await canSeeDocument(user, doc))) {
    throw new ApiError("غير مصرح لك بتحميل هذا المستند", 403);
  }
  const mime = ALLOWED_BY_EXT[extname(doc.filename).toLowerCase()] ?? "application/octet-stream";
  return { buffer: await readDocBytes(doc), filename: doc.filename, mime };
}

async function readDocBytes(doc: StoredDocument): Promise<Buffer> {
  try {
    return await readFile(join(DOCS_DIR, doc.storedName));
  } catch {
    throw new ApiError("ملف المستند غير موجود على الخادم", 404);
  }
}

/**
 * Ownership gate for a parent account: a document is visible only when it is
 * bound to the linked student (linked_student) or to that student's current
 * enrolled class (one_class) — the exact equivalent of what the student
 * would see. Archived and all other visibilities are never visible.
 */
export async function canParentSeeDocument(linkedStudentId: string, doc: StoredDocument): Promise<boolean> {
  if (doc.archived) return false;
  if (doc.visibility === "linked_student") return doc.studentId === linkedStudentId;
  if (doc.visibility === "one_class" && doc.classId) {
    const db = await getDb();
    const cur = await db.query(
      "SELECT 1 FROM student_class_enrollments WHERE student_id = $1 AND class_id = $2 AND is_current = true AND status = 'enrolled' LIMIT 1",
      [linkedStudentId, doc.classId],
    );
    return cur.rows.length > 0;
  }
  return false;
}

function parentViewer(userId: string): SafeUser {
  return { id: userId, email: "", nameAr: "", nameEn: "", role: "parent", active: true, duties: [], createdAt: "", updatedAt: "" };
}

/**
 * Documents visible to a parent account. The linked student id comes only
 * from the database link — client-supplied ids can never widen the scope.
 */
export async function listParentDocuments(parentUserId: string): Promise<DocumentRow[]> {
  const linkedId = await resolveParentStudentId(parentUserId);
  const all = await listAllStored();
  const names = await classMap();
  const visible: StoredDocument[] = [];
  for (const d of all) {
    if (await canParentSeeDocument(linkedId, d)) visible.push(d);
  }
  return enrichDocuments(visible, parentViewer(parentUserId), names);
}

/** Parent-scoped download behind the same ownership gate. */
export async function downloadParentDocument(parentUserId: string, id: string): Promise<DownloadResult> {
  const linkedId = await resolveParentStudentId(parentUserId);
  const doc = await findDocument(id);
  if (!doc) throw new ApiError("المستند غير موجود", 404);
  if (!(await canParentSeeDocument(linkedId, doc))) {
    throw new ApiError("غير مصرح لك بتحميل هذا المستند", 403);
  }
  const mime = ALLOWED_BY_EXT[extname(doc.filename).toLowerCase()] ?? "application/octet-stream";
  return { buffer: await readDocBytes(doc), filename: doc.filename, mime };
}

const ALLOWED_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};