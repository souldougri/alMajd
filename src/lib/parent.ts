import { api } from "./api";
import type { StudentPortfolio } from "./student";
import type { DocumentRow } from "./documents";

/** Loads the read-only portfolio of the linked student for the signed-in parent. */
export async function getParentPortfolio(): Promise<StudentPortfolio> {
  const res = await api.get<{ portfolio: StudentPortfolio | null }>("/api/parent/portfolio");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل البيانات");
  const data = res.data?.portfolio;
  if (!data) throw new Error("حساب ولي الأمر غير مرتبط بأي طالب");
  return data;
}

/** Lists the documents visible to the signed-in parent (linked student only). */
export function fetchParentDocuments(): Promise<{ items: DocumentRow[]; error?: string }> {
  return api
    .get<{ items: DocumentRow[] }>("/api/parent/documents")
    .then((res) => (res.ok ? { items: res.data?.items ?? [] } : { items: [], error: res.error }));
}

/** Returns a URL that triggers the browser download through the parent-authorized endpoint. */
export async function downloadParentUrl(id: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch(`/api/parent/documents/${id}/download`, { credentials: "same-origin" });
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
