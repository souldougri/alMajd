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
  /** Owning branch (sent by the server; required for branch-scoped lists). */
  branchId?: string;
  /** Present in the server payload; preserved so edits never reset it. */
  gender?: string;
};

export type BranchClass = {
  id: string;
  nameAr: string;
  nameFr?: string;
  level?: string | null;
  section?: string | null;
  capacity?: number | null;
  academicYearId?: string;
  headTeacherNameAr?: string;
  active?: boolean;
};

export type AttendanceEntry = {
  id?: string;
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

/**
 * Branches where the given user is currently the primary Financial Officer.
 * Same composition pattern as headed branches (scope-filtered list plus
 * per-branch scoped reads). Resolving assignments only — Financial Officers
 * report to the System Admin, never to a Branch Head.
 */
export async function getFinancialOfficerBranches(userId: string): Promise<Branch[]> {
  const branches = await getBranches();
  const officers = await Promise.all(branches.map((b) => getBranchFinancialOfficer(b.id).catch(() => null)));
  return branches.filter((b, i) => officers[i]?.userId === userId);
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

export type BranchStudentInput = {
  /**
   * Idempotency key for the registration (record + login). The branch form
   * generates one per opened form so retries never create a duplicate.
   */
  id?: string;
  nameAr: string;
  nameFr?: string;
  gender?: string;
  klass?: string;
  /** Preferred over the free-text klass label: must belong to the target branch (server-enforced). */
  classId?: string;
  dob?: string;
  placeOfBirth?: string;
  parentAr?: string;
  phone?: string;
  annualFee?: number;
  /** Optional portal login created in the same registration flow. */
  loginEmail?: string;
  loginPassword?: string;
};

/** One-time account credentials (password present only at creation). */
export type AccountCredentials = {
  email: string;
  password: string;
  created: boolean;
};

/** Registration result: the student record plus both one-time logins (student + parent). */
export type BranchStudentRegistration = {
  student: BranchStudent;
  login: { student: AccountCredentials; parent: AccountCredentials };
};

/** Registers a student in the given branch (target-branch scope enforced server-side). */
export async function registerBranchStudent(branchId: string, input: BranchStudentInput): Promise<BranchStudentRegistration> {
  const res = await api.post<{ student: BranchStudent; login: BranchStudentRegistration["login"] }>("/api/students", { ...input, branchId });
  if (!res.ok || !res.data?.student || !res.data?.login?.student || !res.data?.login?.parent) {
    throw new Error(res.error ?? "تعذر تسجيل الطالب");
  }
  return { student: res.data.student, login: res.data.login };
}

/** Full student record for the profile view (branch scope enforced server-side). */
export type BranchStudentDetails = {
  id: string;
  nameAr: string;
  nameFr?: string;
  gender?: string;
  klass?: string;
  classId?: string;
  dob?: string;
  placeOfBirth?: string;
  parentAr?: string;
  phone?: string;
  enrolled?: string;
  annualFee?: number;
  branchId?: string;
  branchNameAr?: string;
  active?: boolean;
};

/** Login emails only — passwords are never stored nor re-exposed. */
export type StudentLoginStatus = {
  student: { email: string } | null;
  parent: { email: string } | null;
};

export async function getStudentDetails(studentId: string): Promise<BranchStudentDetails> {
  const res = await api.get<{ student: BranchStudentDetails }>(`/api/students/${encodeURIComponent(studentId)}`);
  return unwrap(res, res.data?.student, "تعذر تحميل ملف الطالب");
}

export async function getStudentLoginStatus(studentId: string): Promise<StudentLoginStatus> {
  const res = await api.get<{ logins: StudentLoginStatus }>(`/api/students/${encodeURIComponent(studentId)}/logins`);
  return unwrap(res, res.data?.logins, "تعذر تحميل حالة الحسابات");
}

/** Edits a student record (student's branch scope enforced server-side). */
export async function updateBranchStudent(
  studentId: string,
  input: Partial<BranchStudentInput>,
): Promise<BranchStudent> {
  const res = await api.patch<{ student: BranchStudent }>(`/api/students/${studentId}`, input);
  return unwrap(res, res.data?.student, "تعذر حفظ بيانات الطالب");
}

export type StudentLoginResult = {
  email: string;
  password: string;
  created: boolean;
};

/**
 * Creates (or refreshes) the portal login for an EXISTING student.
 * Permitted to super_admin, registrar duty, and the active Branch Head of
 * the student's own branch (server-enforced). Never general user creation.
 */
export async function ensureBranchStudentLogin(
  studentId: string,
  nameAr: string,
  opts?: { email?: string; password?: string },
): Promise<StudentLoginResult> {
  const res = await api.post<{ login: StudentLoginResult }>("/api/users", {
    role: "student",
    studentId,
    nameAr,
    email: opts?.email,
    initialPassword: opts?.password,
    active: true,
  });
  if (!res.ok) throw new Error(res.error ?? "تعذر إنشاء حساب الدخول");
  return res.data?.login ?? { email: "", password: "", created: false };
}

export type TeachingAssignment = {
  id: string;
  teacherUserId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  assignedAt: string;
  teacherNameAr?: string;
  classNameAr?: string;
  subjectCode?: string;
  yearLabel?: string;
};

/** Teaching assignments of a teacher (workload view). */
export async function getTeacherAssignments(teacherUserId: string): Promise<TeachingAssignment[]> {
  const res = await api.get<{ items: TeachingAssignment[] }>(
    `/api/teaching-assignments?teacherUserId=${encodeURIComponent(teacherUserId)}`,
  );
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل مهام التدريس");
}

/** Assigns a teacher to a class+subject (branch derived from class, scope enforced server-side). */
export async function addTeachingAssignment(input: {
  teacherUserId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
}): Promise<void> {
  const res = await api.post("/api/teaching-assignments", input);
  unwrap(res, undefined, "تعذر إسناد مهمة التدريس");
}

/** Removes a teaching assignment (branch scope enforced server-side). */
export async function removeTeachingAssignment(assignmentId: string): Promise<void> {
  const res = await api.del(`/api/teaching-assignments/${assignmentId}`);
  unwrap(res, undefined, "تعذر إلغاء مهمة التدريس");
}

export type AcademicYear = {
  id: string;
  label: string;
  isCurrent: boolean;
  active: boolean;
};

/** Academic years (readable by any authenticated user; writes stay duty-gated). */
export async function getAcademicYears(): Promise<AcademicYear[]> {
  const res = await api.get<{ items: AcademicYear[] }>("/api/academic/years");
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل السنوات الدراسية");
}

export type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  subjectCode?: string;
  subjectNameAr?: string;
  coefficient: number;
  maxScore: number;
  active: boolean;
};

/** Subjects attached to a class (branch scope enforced server-side). */
export async function getClassSubjects(classId: string): Promise<ClassSubject[]> {
  const res = await api.get<{ items: ClassSubject[] }>(`/api/academic/classes/${classId}/class-subjects`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل مواد الفصل");
}

/** Marks attendance (branch scope enforced server-side via the class). */
export async function markBranchAttendance(input: {
  classId: string;
  studentId: string;
  date: string;
  status: string;
}): Promise<void> {
  const res = await api.post("/api/academic/attendance", input);
  unwrap(res, undefined, "تعذر تسجيل الحضور");
}

/** Removes an attendance mark (branch scope enforced server-side). */
export async function removeBranchAttendance(attendanceId: string): Promise<void> {
  const res = await api.del(`/api/academic/attendance/${attendanceId}`);
  unwrap(res, undefined, "تعذر حذف تسجيل الحضور");
}

export type BranchWarning = {
  id: string;
  studentId: string;
  studentNameAr: string;
  kind: string;
  date: string;
  body: string;
};

/** Warnings of a branch (branch scope enforced server-side). */
export async function getBranchWarnings(branchId: string): Promise<BranchWarning[]> {
  const res = await api.get<{ items: BranchWarning[] }>(
    `/api/academic/warnings?branchId=${encodeURIComponent(branchId)}`,
  );
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل التنبيهات");
}

/** Issues a warning (branch scope enforced server-side). */
export async function addBranchWarning(input: {
  studentId: string;
  branchId: string;
  kind: string;
  date: string;
  body?: string;
}): Promise<void> {
  const res = await api.post("/api/academic/warnings", input);
  unwrap(res, undefined, "تعذر إصدار التنبيه");
}

/** Removes a warning (branch scope enforced server-side). */
export async function removeBranchWarning(warningId: string): Promise<void> {
  const res = await api.del(`/api/academic/warnings/${warningId}`);
  unwrap(res, undefined, "تعذر حذف التنبيه");
}

export type BranchClassInput = {
  academicYearId: string;
  nameAr: string;
  nameFr?: string;
  level?: string;
  section?: string;
  capacity?: number;
  active?: boolean;
};

/**
 * Creates a class in a branch.
 * super_admin OR academic/registrar duty OR Branch Head of the branch
 * (server-enforced; cross-branch creation returns 403).
 */
export async function createBranchClass(branchId: string, input: BranchClassInput): Promise<BranchClass> {
  const res = await api.post<{ item: BranchClass }>("/api/academic/classes", { ...input, branchId });
  return unwrap(res, res.data?.item, "تعذر إنشاء الفصل");
}

/** Edits a class (same authority as creation, resolved from the class). */
export async function updateBranchClass(
  classId: string,
  input: Partial<Omit<BranchClassInput, "academicYearId">>,
): Promise<BranchClass> {
  const res = await api.patch<{ item: BranchClass }>(`/api/academic/classes/${classId}`, input);
  return unwrap(res, res.data?.item, "تعذر حفظ بيانات الفصل");
}

/** Attaches a subject to a class (head of class branch, academic duty, or admin). */
export async function attachClassSubject(
  classId: string,
  input: { subjectId: string; coefficient?: number; maxScore?: number },
): Promise<void> {
  const res = await api.post(`/api/academic/classes/${classId}/class-subjects`, input);
  unwrap(res, undefined, "تعذر ربط المادة بالفصل");
}

/** Detaches a subject from a class (same authority as attaching). */
export async function detachClassSubject(classId: string, subjectId: string): Promise<void> {
  const res = await api.del(`/api/academic/classes/${classId}/class-subjects/${subjectId}`);
  unwrap(res, undefined, "تعذر فصل المادة عن الفصل");
}

export type TimetableSlot = {
  id: string;
  classId: string;
  day: number;
  slot: number;
  subjectId: string;
  subjectCode?: string;
};

/** Timetable slots of a class (branch scope enforced server-side). */
export async function getClassTimetable(classId: string): Promise<TimetableSlot[]> {
  const res = await api.get<{ items: TimetableSlot[] }>(`/api/academic/classes/${classId}/timetable`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل الجدول الدراسي");
}

/** Creates/updates one timetable slot (head of class branch, academic duty, or admin). */
export async function upsertTimetableSlot(
  classId: string,
  input: { day: number; slot: number; subjectId: string },
): Promise<void> {
  const res = await api.post(`/api/academic/classes/${classId}/timetable`, input);
  unwrap(res, undefined, "تعذر حفظ الحصة");
}

/** Removes one timetable slot (same authority as upsert). */
export async function removeTimetableSlot(classId: string, entryId: string): Promise<void> {
  const res = await api.del(`/api/academic/classes/${classId}/timetable/${entryId}`);
  unwrap(res, undefined, "تعذر حذف الحصة");
}

export type ExamSession = {
  id: string;
  termId: string;
  termNameAr?: string;
  branchId: string;
  name: string;
  date: string;
};

export type Term = {
  id: string;
  nameAr: string;
  active: boolean;
};

/** Exam sessions of a branch (branch scope enforced server-side). */
export async function getBranchExamSessions(branchId: string): Promise<ExamSession[]> {
  const res = await api.get<{ items: ExamSession[] }>(
    `/api/academic/exam-sessions?branchId=${encodeURIComponent(branchId)}`,
  );
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل الامتحانات");
}

/** Creates an exam session (head of branch, academic duty, or admin). No delete API exists. */
export async function createBranchExamSession(input: {
  branchId: string;
  termId: string;
  name: string;
  date: string;
}): Promise<void> {
  const res = await api.post("/api/academic/exam-sessions", input);
  unwrap(res, undefined, "تعذر إنشاء الامتحان");
}

export type CatalogSubject = {
  id: string;
  code: string;
  nameAr: string;
  active: boolean;
  /** Owning branch for branch-created subjects; undefined = global catalog entry. */
  branchId?: string;
};

/** Global subject catalog (readable by any authenticated user; catalog writes stay duty-gated). */
export async function getSubjectsCatalog(): Promise<CatalogSubject[]> {
  const res = await api.get<{ items: CatalogSubject[] }>("/api/academic/subjects");
  return unwrap(res, (res.data?.items ?? []).filter((s) => s.active), "تعذر تحميل المواد");
}

/** Subjects usable in a branch: global catalog plus that branch's own subjects (branch scope enforced server-side). */
export async function getBranchSubjects(branchId: string): Promise<CatalogSubject[]> {
  const res = await api.get<{ items: CatalogSubject[] }>(`/api/academic/subjects?branchId=${encodeURIComponent(branchId)}`);
  return unwrap(res, (res.data?.items ?? []).filter((s) => s.active), "تعذر تحميل المواد");
}

/** Creates a subject inside a branch (name only — code auto-generated). Branch scope enforced server-side. */
export async function createBranchSubject(branchId: string, input: { nameAr: string; nameFr?: string }): Promise<CatalogSubject> {
  const res = await api.post<{ item: CatalogSubject }>("/api/academic/subjects", { ...input, branchId });
  if (!res.ok || !res.data?.item) throw new Error(res.error ?? "تعذر إنشاء المادة");
  return res.data.item;
}

/** Active terms for pickers (readable by any authenticated user). */
export async function getTerms(): Promise<Term[]> {
  const res = await api.get<{ items: Term[] }>("/api/academic/terms");
  return unwrap(res, (res.data?.items ?? []).filter((t) => t.active), "تعذر تحميل الفصول الدراسية");
}

export type PublishedResult = {
  classId: string;
  termId: string;
  published: boolean;
};

/** Published-result flags of a class (branch scope enforced server-side). */
export async function getClassPublishedResults(classId: string): Promise<PublishedResult[]> {
  const res = await api.get<{ items: PublishedResult[] }>(`/api/academic/classes/${classId}/results`);
  return unwrap(res, res.data?.items ?? [], "تعذر تحميل حالة النشر");
}

/** Publishes/unpublishes a class bulletin (head of class branch, academic duty, or admin). */
export async function setClassPublishedResult(classId: string, termId: string, published: boolean): Promise<void> {
  const res = await api.post(`/api/academic/classes/${classId}/results`, { termId, published });
  unwrap(res, undefined, "تعذر تحديث حالة النشر");
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
