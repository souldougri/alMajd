/**
 * Documents archive: uploads, visibility rules, download, archive/hide.
 *
 * Files are stored under `.data/uploads/docs/`; metadata lives in the
 * `documents` table. Server-only module — never import from client code.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { uid, getSchoolDocumentRow } from "./auth";
import { DOCS_DIR, MAX_UPLOAD_BYTES, validateUpload } from "./uploads";
import type { SafeUser } from "@/lib/auth/types";
import type { ClassSection, Student } from "@/lib/types";

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
  filename: string;
  mime: string;
  byteLength: number;
  bytes: Buffer;
};

/** Class ids assigned to a teacher account. */
async function teacherClassIds(user: SafeUser): Promise<Set<string>> {
  const row = await getSchoolDocumentRow();
  const ids = new Set<string>();
  if (!row) return ids;
  const doc = row.document as { classes?: Array<ClassSection & { teacherStaffId?: string; active?: boolean }> };
  for (const c of doc.classes ?? []) {
    if (c.active !== false && c.teacherStaffId === user.id) ids.add(c.id);
  }
  return ids;
}

async function classMap(): Promise<Map<string, string>> {
  const row = await getSchoolDocumentRow();
  const map = new Map<string, string>();
  if (!row) return map;
  const doc = row.document as { classes?: ClassSection[]; students?: Student[] };
  for (const c of doc.classes ?? []) map.set(c.id, c.nameAr);
  for (const s of doc.students ?? []) map.set(`student:${s.id}`, s.nameAr);
  return map;
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
  if (user.role === "student") {
    throw new ApiError("حسابات الطلاب لا يمكنها رفع مستندات", 403);
  }

  assertAllowedVisibility(input.visibility);
  assertAllowedCategory(input.category);
  const title = cleanStr(input.title);
  if (!title) throw new ApiError("عنوان المستند مطلوب");

  const { ext, mime } = validateUpload(input.filename, input.byteLength);
  const visibility = input.visibility;
  let classId: string | null = null;
  let studentId: string | null = null;

  const row = await getSchoolDocumentRow();
  const doc = row?.document as
    | { classes?: Array<{ id: string }>; students?: Array<{ id: string }> }
    | undefined;

  if (user.role === "super_admin") {
    if (visibility === "one_class") {
      classId = cleanStr(input.classId);
      if (!classId) throw new ApiError("اختر الصف المستفيد من المستند");
      if (!doc?.classes?.some((c) => c.id === classId)) throw new ApiError("الصف غير موجود");
    }
    if (visibility === "linked_student") {
      studentId = cleanStr(input.studentId);
      if (!studentId) throw new ApiError("اختر الطالب المرتبط بالمستند");
      if (!doc?.students?.some((s) => s.id === studentId)) throw new ApiError("الطالب غير موجود");
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
      if (!doc?.classes?.some((c) => c.id === classId)) throw new ApiError("الصف غير موجود");
    } else if (duties.has("registrar")) {
      if (visibility !== "linked_student") {
        throw new ApiError("يمكن لأمين السجل رفع ملفات على سجل طالب محدد فقط", 403);
      }
      if (input.category !== "طالب") {
        throw new ApiError("تصنيف ملفات أمين السجل يجب أن يكون من فئة طالب", 403);
      }
      studentId = cleanStr(input.studentId);
      if (!studentId) throw new ApiError("اختر الطالب المرتبط بالملف");
      if (!doc?.students?.some((s) => s.id === studentId)) throw new ApiError("الطالب غير موجود");
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
  await mkdir(dir, { recursive: true });

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(`حجم الملف يتجاوز الحد الأقصى المسموح (10 MB)`);
  }
  await writeFile(join(dir, storedName), input.bytes);

  const now = new Date().toISOString();
  await (
    await getDb()
  ).query(
    `INSERT INTO documents (id, title, category, visibility, class_id, student_id, filename, stored_name, size_bytes, mime, uploaded_by_user_id, uploaded_by_name, archived, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      title,
      input.category,
      visibility,
      classId,
      studentId,
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
        const row = await getSchoolDocumentRow();
        if (!row) return false;
        const docRow = row.document as { students?: Student[] };
        const student = docRow.students?.find((s) => s.id === user.studentId);
        return student?.classId === doc.classId;
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
 * filtering to a single class or student (used by workspace panels).
 */
export async function listDocumentsForUser(
  user: SafeUser,
  opts?: { classId?: string; studentId?: string },
): Promise<DocumentRow[]> {
  const all = await listAllStored();
  const names = await classMap();
  const visible: StoredDocument[] = [];
  for (const d of all) {
    if (!(await canSeeDocument(user, d))) continue;
    if (opts?.classId && d.classId && d.classId !== opts.classId) continue;
    if (opts?.classId && !d.classId) continue;
    if (opts?.studentId && d.studentId && d.studentId !== opts.studentId) continue;
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
  let buffer: Buffer;
  try {
    buffer = await readFile(join(DOCS_DIR, doc.storedName));
  } catch {
    throw new ApiError("ملف المستند غير موجود على الخادم", 404);
  }
  const mime = ALLOWED_BY_EXT[extname(doc.filename).toLowerCase()] ?? "application/octet-stream";
  return { buffer, filename: doc.filename, mime };
}

const ALLOWED_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};