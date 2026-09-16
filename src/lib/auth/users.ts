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

export type StudentLoginResult = {
  user: SafeUser;
  email: string;
  password: string;
  created: boolean;
};

/**
 * Creates (or refreshes) the bound portal login for a student record
 * (registrar workspace). The server generates a login id when no email is
 * provided and returns the credentials so the registrar can share them.
 */
export async function ensureStudentLogin(input: {
  studentId: string;
  nameAr: string;
  nameEn?: string;
  email?: string;
  password?: string;
}): Promise<StudentLoginResult> {
  const res = await api.post<{ user: SafeUser; login?: { email: string; password: string; created: boolean } }>("/api/users", {
    studentId: input.studentId,
    nameAr: input.nameAr,
    nameEn: input.nameEn ?? input.nameAr,
    email: input.email ?? "",
    role: "student",
    active: true,
    initialPassword: input.password ?? "",
  });
  if (!res.ok) throw new Error(res.error ?? "فشل إنشاء حساب الدخول");
  return {
    user: res.data?.user as SafeUser,
    email: res.data?.login?.email ?? ((res.data?.user as SafeUser | undefined)?.email ?? ""),
    password: res.data?.login?.password ?? "",
    created: res.data?.login?.created ?? false,
  };
}

/** Deactivates a student's portal login when their record is removed. */
export async function deactivateStudentLogin(studentId: string): Promise<void> {
  const res = await api.post<{ disabled: boolean }>("/api/users", {
    disableLogin: true,
    studentId,
  });
  if (!res.ok) throw new Error(res.error ?? "تعذر تعطيل حساب الدخول");
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