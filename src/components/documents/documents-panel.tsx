import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileUp,
  FileText,
  FolderOpen,
  Loader2,
} from "lucide-react";
import {
  downloadUrl,
  fetchDocuments,
  formatBytes,
  setArchived,
  uploadDocument,
  type DocCategory,
  type DocVisibility,
  type DocumentRow,
} from "@/lib/documents";
import { formatPrintDate } from "@/lib/print";
import { cn } from "@/lib/utils";

type Props = {
  /** Whether upload controls are shown for this account. */
  canUpload?: boolean;
  /** Locked upload mode — student files on a record, or educational file for a class. */
  uploadMode?: "one_class" | "linked_student";
  /** Full freedom (super_admin console). */
  allowAnyMode?: boolean;
  classes?: Array<{ id: string; nameAr: string }>;
  students?: Array<{ id: string; nameAr: string }>;
  showArchived?: boolean;
  /**
   * Optional data-source overrides (e.g. the parent portal, whose documents
   * come from the parent-authorized endpoint). Defaults keep the standard
   * student/document endpoints.
   */
  fetchItems?: () => Promise<{ items: DocumentRow[]; error?: string }>;
  downloadItem?: (id: string) => Promise<{ url?: string; error?: string }>;
};

const CATEGORY_OPTIONS: DocCategory[] = ["إداري", "طالب", "تعليمي", "أخرى"];

export function DocumentsPanel({
  canUpload = false,
  uploadMode,
  allowAnyMode = false,
  classes = [],
  students = [],
  showArchived = false,
  fetchItems = fetchDocuments,
  downloadItem = downloadUrl,
}: Props) {
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocCategory>("تعليمي");
  const [visibility, setVisibility] = useState<DocVisibility>("one_class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reload() {
    setLoading(true);
    setError(null);
    fetchItems()
      .then((result) => {
        setItems(result.items);
        if (result.error) setError(result.error);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleUpload() {
    setUploading(true);
    setUploadError(null);
    if (!file) {
      setUploadError("اختر ملفًا أولاً (PDF / JPG / PNG)");
      setUploading(false);
      return;
    }
    const payload: {
      title: string;
      category: DocCategory;
      visibility: DocVisibility;
      classId?: string;
      studentId?: string;
      file: File;
    } = { title, category, visibility, file };

    if (allowAnyMode) {
      if (visibility === "one_class") {
        if (!classId) {
          setUploadError("اختر الصف المستفيد من الملف");
          setUploading(false);
          return;
        }
        payload.classId = classId;
      } else if (visibility === "linked_student") {
        if (!studentId) {
          setUploadError("اختر الطالب المرتبط بالملف");
          setUploading(false);
          return;
        }
        payload.studentId = studentId;
      }
    } else if (uploadMode === "one_class") {
      payload.visibility = "one_class";
      payload.category = "تعليمي";
      if (!classId) {
        setUploadError("اختر الصف المستفيد من الملف التعليمي");
        setUploading(false);
        return;
      }
      payload.classId = classId;
    } else if (uploadMode === "linked_student") {
      payload.visibility = "linked_student";
      payload.category = "طالب";
      if (!studentId) {
        setUploadError("اختر الطالب المرتبط بالملف");
        setUploading(false);
        return;
      }
      payload.studentId = studentId;
    }

    const result = await uploadDocument(payload);
    setUploading(false);
    if (result.error) {
      setUploadError(result.error);
      return;
    }
    setTitle("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    reload();
  }

  async function handleDownload(item: DocumentRow) {
    const result = await downloadItem(item.id);
    if (result.error) {
      setUploadError(result.error);
      return;
    }
    if (result.url) {
      const a = document.createElement("a");
      a.href = result.url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(result.url as string), 5000);
    }
  }

  async function handleArchive(item: DocumentRow) {
    const result = await setArchived(item.id, !item.archived);
    if (result.error) {
      setUploadError(result.error);
      return;
    }
    reload();
  }

  const showArchivedRow = showArchived ? items : items.filter((i) => !i.archived);

  return (
    <div className="space-y-4">
      {canUpload ? (
        <section className="am-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold text-navy">
            <FileUp className="size-4 text-gold" />
            رفع مستند
          </h3>

          {allowAnyMode ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">التصنيف</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">الوجهة</span>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as DocVisibility)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  <option value="admin_only">خاص بالمدير فقط</option>
                  <option value="staff">لكل الطاقم الإداري</option>
                  <option value="teachers">لكل الأساتذة</option>
                  <option value="one_class">فصل محدد</option>
                  <option value="linked_student">سجل طالب محدد</option>
                </select>
              </label>
            </div>
          ) : null}

          {allowAnyMode && visibility === "one_class" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">الفصل المستفيد</span>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  <option value="">— اختر الفصل —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {allowAnyMode && visibility === "linked_student" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">الطالب المرتبط</span>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  <option value="">— اختر الطالب —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {!allowAnyMode && uploadMode === "one_class" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">الفصل المستفيد</span>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  <option value="">— اختر الفصل —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">التصنيف</span>
                <input readOnly value="تعليمي" className="h-10 w-full rounded-md border border-navy/10 bg-cream-subtle px-3 text-sm font-semibold text-navy/70" />
              </label>
            </div>
          ) : null}

          {!allowAnyMode && uploadMode === "linked_student" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">الطالب المرتبط</span>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm">
                  <option value="">— اختر الطالب —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-navy/60">التصنيف</span>
                <input readOnly value="طالب" className="h-10 w-full rounded-md border border-navy/10 bg-cream-subtle px-3 text-sm font-semibold text-navy/70" />
              </label>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">عنوان المستند</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-md border border-navy/10 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="مثال: قائمة الطلاب — الفصل الأول" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-navy/60">الملف</span>
              <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-10 w-full text-sm text-navy file:mr-3 file:h-full file:rounded-md file:border-0 file:bg-navy file:px-4 file:text-xs file:font-bold file:text-gold" />
            </label>
          </div>

          {uploadError ? <p className="mt-2 text-xs font-semibold text-danger">{uploadError}</p> : null}

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="mt-3 flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-gold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {uploading ? "جارٍ الرفع..." : "رفع المستند"}
          </button>
        </section>
      ) : null}

      <section className="am-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-navy/10 px-5 py-3">
          <FolderOpen className="size-4 text-gold" />
          <h3 className="font-bold text-navy">المستندات المتاحة</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-navy/60">
            <Loader2 className="size-5 animate-spin text-gold" />
            <span className="text-sm">جارٍ التحميل...</span>
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-danger">{error}</p>
        ) : showArchivedRow.length === 0 ? (
          <p className="py-10 text-center text-sm text-navy/50">لا توجد مستندات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10 bg-cream-subtle text-start text-xs font-bold text-navy/70">
                  <th className="px-4 py-2.5 text-start">المستند</th>
                  <th className="px-4 py-2.5 text-start">التصنيف</th>
                  <th className="px-4 py-2.5 text-start">الصلة</th>
                  <th className="px-4 py-2.5 text-start">التاريخ</th>
                  <th className="px-4 py-2.5 text-start">الحجم</th>
                  <th className="px-4 py-2.5 text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {showArchivedRow.map((item) => (
                  <tr key={item.id} className={cn("border-b border-navy/5 last:border-0", item.archived && "opacity-60")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-navy/40" />
                        <div className="min-w-0">
                          <p className="font-semibold text-navy">{item.title}</p>
                          <p className="text-xs text-navy/45">{item.filename} · {item.uploadedByName}</p>
                        </div>
                        {item.archived ? (
                          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy/60">مؤرشف</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-cream-subtle px-2.5 py-0.5 text-xs font-semibold text-navy/70">{item.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-navy/60">
                      {item.className ? `فصل ${item.className}` : item.studentName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-navy/60">{formatPrintDate(item.createdAt.slice(0, 10))}</td>
                    <td className="px-4 py-2.5 text-xs text-navy/60">{formatBytes(item.sizeBytes)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          aria-label="تحميل"
                          className="flex size-8 items-center justify-center rounded-lg text-navy/70 transition-colors hover:bg-cream hover:text-navy"
                        >
                          <Download className="size-4" />
                        </button>
                        {item.canManage ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(item)}
                            aria-label={item.archived ? "إعادة إظهار" : "أرشفة"}
                            className="flex size-8 items-center justify-center rounded-lg text-navy/70 transition-colors hover:bg-cream hover:text-navy"
                          >
                            {item.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}