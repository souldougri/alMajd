import { api } from "@/lib/api";

export type Branch = {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  address: string;
  phone: string;
  active: boolean;
  isDefault: boolean;
};

export type BranchHead = {
  id: string;
  branchId: string;
  userId: string;
  userNameAr: string;
  userEmail: string;
  active: boolean;
  assignedAt: string;
  appointedBy?: string;
};

export type BranchFinancialOfficer = {
  id: string;
  branchId: string;
  branchName?: string;
  userId: string;
  userNameAr: string;
  userEmail: string;
  active: boolean;
  assignedAt: string;
  appointedBy?: string;
};

export type BranchMember = {
  id: string;
  userId: string;
  branchId: string;
  assignedAt: string;
  userNameAr?: string;
};

export type BranchTeacher = {
  id: string;
  teacherUserId: string;
  branchId: string;
  assignedAt: string;
  userNameAr?: string;
};

export type BranchDuty = {
  id: string;
  userId: string;
  branchId: string;
  dutyCode: string;
  assignedAt: string;
  userNameAr?: string;
};

export type BranchStudent = {
  id: string;
  nameAr: string;
  klass: string;
  classId?: string;
};

export type BranchClass = {
  id: string;
  nameAr: string;
  headTeacherNameAr?: string;
};

export type AttendanceEntry = {
  studentId: string;
  studentNameAr: string;
  status: string;
  date: string;
};

function unwrap<T>(res: { ok: boolean; error?: string }, data: T | undefined, fallback: string): T {
  if (!res.ok) throw new Error(res.error ?? fallback);
  return data as T;
}

/** Lists branches visible to the signed-in user (super_admin sees all). */
export async function getBranches(): Promise<Branch[]> {
  const res = await api.get<{ branches: Branch[] }>("/api/branches");
  return unwrap(res, res.data?.branches ?? [], "تعذر تحميل قائمة الفروع");
}

/**
 * Branches where the given user is currently the active Branch Head.
 * Composed from the scope-filtered branch list plus the per-branch head read
 * (both server-authorized); the assignment disappearing removes the branch
 * here automatically on the next load.
 */
export async function getHeadedBranches(userId: string): Promise<Branch[]> {
  const branches = await getBranches();
  const heads = await Promise.all(branches.map((b) => getBranchHead(b.id).catch(() => null)));
  return branches.filter((b, i) => heads[i]?.userId === userId);
}

/** Students enrolled in a branch (branch scope enforced server-side). */
export async function getBranchStudents(branchId: string): Promise<BranchStudent[]> {
  const res = await api.get<{ items: BranchStudent[] }>(`/api/students?branchId=${encodeURIComponent(branchId)}`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل طلاب الفرع");
}

/** Classes of a branch (branch scope enforced server-side). */
export async function getBranchClasses(branchId: string): Promise<BranchClass[]> {
  const res = await api.get<{ items: BranchClass[] }>(`/api/academic/classes?branchId=${encodeURIComponent(branchId)}`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل فصول الفرع");
}

/** Attendance marks of one class on one date (branch scope enforced server-side). */
export async function getClassAttendance(classId: string, date: string): Promise<AttendanceEntry[]> {
  const res = await api.get<{ items: AttendanceEntry[] }>(
    `/api/academic/attendance?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
  );
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل الحضور");
}

export type BranchInput = {
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  active?: boolean;
};

/** Creates a branch (super_admin only, enforced server-side). */
export async function createBranch(input: BranchInput): Promise<Branch> {
  const res = await api.post<{ branch: Branch }>("/api/branches", input);
  return unwrap(res, res.data?.branch, "تعذر إنشاء الفرع");
}

/** Updates a branch (super_admin only, enforced server-side). */
export async function updateBranch(id: string, input: BranchInput): Promise<Branch> {
  const res = await api.patch<{ branch: Branch }>(`/api/branches/${id}`, input);
  return unwrap(res, res.data?.branch, "تعذر حفظ بيانات الفرع");
}

/** Active Branch Head of a branch, or null (branch-scoped read). */
export async function getBranchHead(branchId: string): Promise<BranchHead | null> {
  const res = await api.get<{ head: BranchHead | null }>(`/api/branches/${branchId}/branch-head`);
  return unwrap(res, res.data?.head ?? null, "تعذر تحميل مدير الفرع");
}

/** Appoints the Branch Head (super_admin only, enforced server-side). */
export async function assignBranchHead(branchId: string, userId: string): Promise<void> {
  const res = await api.post(`/api/branches/${branchId}/branch-head`, { userId });
  unwrap(res, undefined, "تعذر تعيين مدير الفرع");
}

/** Removes the active Branch Head (super_admin only, enforced server-side). */
export async function removeBranchHead(branchId: string): Promise<void> {
  const res = await api.del(`/api/branches/${branchId}/branch-head`);
  unwrap(res, undefined, "تعذر إلغاء مدير الفرع");
}

/** Primary Financial Officer of a branch, or null (branch-scoped read). */
export async function getBranchFinancialOfficer(branchId: string): Promise<BranchFinancialOfficer | null> {
  const res = await api.get<{ officer: BranchFinancialOfficer | null }>(`/api/branches/${branchId}/financial-officer`);
  return unwrap(res, res.data?.officer ?? null, "تعذر تحميل المسؤول المالي");
}

/** Assigns/changes the primary Financial Officer (super_admin only, enforced server-side). */
export async function assignBranchFinancialOfficer(branchId: string, userId: string): Promise<void> {
  const res = await api.post(`/api/branches/${branchId}/financial-officer`, { userId });
  unwrap(res, undefined, "تعذر تعيين المسؤول المالي");
}

/** Removes the Financial Officer (super_admin only, enforced server-side). */
export async function removeBranchFinancialOfficer(branchId: string): Promise<void> {
  const res = await api.del(`/api/branches/${branchId}/financial-officer`);
  unwrap(res, undefined, "تعذر إلغاء المسؤول المالي");
}

/** Employees assigned to a branch. */
export async function getBranchMembers(branchId: string): Promise<BranchMember[]> {
  const res = await api.get<{ items: BranchMember[] }>(`/api/branches/${branchId}/members`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل موظفي الفرع");
}

/** Assigns an employee to a branch (branch scope enforced server-side). */
export async function addBranchMember(branchId: string, userId: string): Promise<void> {
  const res = await api.post(`/api/branches/${branchId}/members`, { userId });
  unwrap(res, undefined, "تعذر إلحاق الموظف بالفرع");
}

/** Removes an employee from a branch (branch scope enforced server-side). */
export async function removeBranchMember(branchId: string, userId: string): Promise<void> {
  // DELETE with body is not supported by the shared client; use fetch directly.
  const raw = await fetch(`/api/branches/${branchId}/members`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = (await raw.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!raw.ok || !json || json.ok === false) {
    throw new Error(json?.error ?? "تعذر إزالة الموظف من الفرع");
  }
}

/** Teachers assigned to a branch (many-to-many: a teacher may span branches). */
export async function getBranchTeachers(branchId: string): Promise<BranchTeacher[]> {
  const res = await api.get<{ items: BranchTeacher[] }>(`/api/branches/${branchId}/teachers`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل معلمي الفرع");
}

/** Assigns a teacher to a branch (branch scope enforced server-side). */
export async function addBranchTeacher(branchId: string, userId: string): Promise<void> {
  const res = await api.post(`/api/branches/${branchId}/teachers`, { userId });
  unwrap(res, undefined, "تعذر إلحاق المعلم بالفرع");
}

/** Removes a teacher from a branch (branch scope enforced server-side). */
export async function removeBranchTeacher(branchId: string, userId: string): Promise<void> {
  const raw = await fetch(`/api/branches/${branchId}/teachers`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = (await raw.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!raw.ok || !json || json.ok === false) {
    throw new Error(json?.error ?? "تعذر إزالة المعلم من الفرع");
  }
}

/** Operational responsibilities delegated inside a branch. */
export async function getBranchDuties(branchId: string): Promise<BranchDuty[]> {
  const res = await api.get<{ items: BranchDuty[] }>(`/api/branches/${branchId}/duties`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل مسؤوليات الفرع");
}

/** Delegates an operational responsibility (branch scope enforced server-side). */
export async function addBranchDuty(branchId: string, userId: string, dutyCode: string): Promise<void> {
  const res = await api.post(`/api/branches/${branchId}/duties`, { userId, dutyCode });
  unwrap(res, undefined, "تعذر تفويض المسؤولية");
}

/** Removes a delegated responsibility (branch scope enforced server-side). */
export async function removeBranchDuty(branchId: string, responsibilityId: string): Promise<void> {
  const res = await api.del(`/api/branches/${branchId}/duties/${responsibilityId}`);
  unwrap(res, undefined, "تعذر إلغاء المسؤولية");
}
