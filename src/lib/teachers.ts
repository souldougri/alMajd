import { api } from "@/lib/api";
import type { SafeUser } from "@/lib/auth/types";

export type TeacherOption = {
  id: string;
  nameAr: string;
};

/** Lists active teacher users for dropdown selections (requires desk access). */
export async function getTeacherOptions(): Promise<TeacherOption[]> {
  const res = await api.get<{ teachers: SafeUser[] }>("/api/teachers");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل قائمة المعلمين");
  return (res.data?.teachers ?? []).map((u) => ({
    id: u.id,
    nameAr: u.nameAr,
  }));
}
