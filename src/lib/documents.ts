import { api } from "./api";

export type DocVisibility = "admin_only" | "staff" | "teachers" | "one_class" | "linked_student";
export type DocCategory = "إداري" | "طالب" | "تعليمي" | "أخرى";

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

export function fetchDocuments(opts?: {
  classId?: string;
  studentId?: string;
}): Promise<{ items: DocumentRow[]; error?: string }> {
  const params = new URLSearchParams();
  if (opts?.classId) params.set("classId", opts.classId);
  if (opts?.studentId) params.set("studentId", opts.studentId);
  const qs = params.toString();
  return api
    .get<{ items: DocumentRow[] }>(`/api/documents${qs ? `?${qs}` : ""}`)
    .then((res) => (res.ok ? { items: res.data?.items ?? [] } : { items: [], error: res.error }));
}

export function uploadDocument(input: {
  title: string;
  category: DocCategory;
  visibility: DocVisibility;
  classId?: string;
  studentId?: string;
  file: File;
}): Promise<{ item?: DocumentRow; error?: string }> {
  const form = new FormData();
  form.append("title", input.title);
  form.append("category", input.category);
  form.append("visibility", input.visibility);
  if (input.classId) form.append("classId", input.classId);
  if (input.studentId) form.append("studentId", input.studentId);
  form.append("file", input.file);
  return api
    .upload<{ item: DocumentRow }>("/api/documents", form)
    .then((res) => (res.ok ? { item: res.data?.item } : { error: res.error }));
}

export function setArchived(id: string, archived: boolean): Promise<{ item?: DocumentRow; error?: string }> {
  return api
    .post<{ item: DocumentRow }>(`/api/documents/${id}/archive`, { archived })
    .then((res) => (res.ok ? { item: res.data?.item } : { error: res.error }));
}

/** Returns a URL that triggers the browser download for the file content. */
export async function downloadUrl(id: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch(`/api/documents/${id}/download`, { credentials: "same-origin" });
  if (!res.ok) {
    let error = `فشل التحميل (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) error = json.error;
    } catch {
      /* ignore */
    }
    return { error };
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}