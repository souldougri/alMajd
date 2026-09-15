import { api } from "@/lib/api";
import type { Role, SafeUser, StaffDuty } from "./types";

export type UserInput = {
  nameAr: string;
  nameEn: string;
  email: string;
  role: Role;
  active: boolean;
  initialPassword: string;
  studentId?: string;
  duties?: StaffDuty[];
};

export type UserUpdates = Partial<{
  nameAr: string;
  nameEn: string;
  email: string;
  role: Role;
  active: boolean;
  studentId: string | null;
  duties: StaffDuty[] | null;
}>;

/** Lists all users (requires super_admin). */
export async function getUsers(): Promise<SafeUser[]> {
  const res = await api.get<{ users: SafeUser[] }>("/api/users");
  if (!res.ok) throw new Error(res.error ?? "تعذر تحميل قائمة المستخدمين");
  return res.data?.users ?? [];
}

/** Creates a new user (requires super_admin). */
export async function createUser(input: UserInput, _actor: SafeUser): Promise<SafeUser> {
  const res = await api.post<{ user: SafeUser }>("/api/users", {
    email: input.email,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    role: input.role,
    active: input.active,
    initialPassword: input.initialPassword,
    studentId: input.studentId || null,
    duties: input.duties ?? [],
  });
  if (!res.ok) throw new Error(res.error ?? "حدث خطأ أثناء إنشاء الحساب");
  return res.data?.user as SafeUser;
}

/** Updates a user's name/email/role/active (requires super_admin). */
export async function editUser(id: string, updates: UserUpdates, _actor: SafeUser): Promise<SafeUser> {
  const res = await api.put<{ user: SafeUser }>(`/api/users/${encodeURIComponent(id)}`, updates);
  if (!res.ok) throw new Error(res.error ?? "حدث خطأ أثناء تحديث الحساب");
  return res.data?.user as SafeUser;
}

/** Enables or disables a user (requires super_admin). */
export async function toggleUserActive(id: string, active: boolean, _actor: SafeUser): Promise<SafeUser> {
  return editUser(id, { active }, _actor);
}

/** Resets a user's password (requires super_admin). */
export async function resetUserPassword(id: string, newPassword: string, _actor: SafeUser): Promise<SafeUser> {
  const res = await api.post<{ user: SafeUser }>(`/api/users/${encodeURIComponent(id)}/reset-password`, {
    password: newPassword,
  });
  if (!res.ok) throw new Error(res.error ?? "حدث خطأ أثناء إعادة تعيين كلمة المرور");
  return res.data?.user as SafeUser;
}

/** Deletes a user (requires super_admin). */
export async function removeUser(id: string, _actor: SafeUser): Promise<SafeUser> {
  const res = await api.del<{ user: SafeUser }>(`/api/users/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(res.error ?? "حدث خطأ أثناء حذف الحساب");
  return res.data?.user as SafeUser;
}