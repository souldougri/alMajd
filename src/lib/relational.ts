/**
 * Relational persistence adapter (Step 16).
 *
 * The client store is a synchronous UI cache. Every mutation funnels through
 * `store.syncToStorage(next)` which forwards the previous and next snapshots to
 * `pushChanges`. That diff is translated into minimal create/update/delete
 * calls against the PostgreSQL relational APIs, which are the single source of
 * truth. Store state is bootstrapped and reconciled by `hydrateStore`.
 *
 * On the Electron desktop build everything is a no-op — the desktop bridge keeps
 * the JSON file for the time being (documented temporary compatibility).
 *
 * Never import this module from server code.
 */
import { api } from "@/lib/api";
import type {
  AttendanceMap,
  ClassSection,
  ExamSession,
  Expense,
  FeeType,
  Grade,
  Payment,
  Staff,
  Student,
  Subject,
  Term,
  TimetableEntry,
  Warning,
} from "@/lib/types";

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "alMajdDesktop" in window;
}

// ---------------------------------------------------------------------------
// Minimal mirrors of the relational row shapes returned by the API
// ---------------------------------------------------------------------------

type BranchRow = { id: string; nameAr: string; isDefault: boolean; active: boolean };
type YearRow = { id: string; label: string; isCurrent: boolean };
type TeacherRow = { id: string; nameAr: string; nameEn?: string; active: boolean };
type ClassRow = {
  id: string;
  branchId: string;
  academicYearId: string;
  nameAr: string;
  nameFr?: string;
  level?: string;
  section?: string;
  capacity?: number;
  headTeacherUserId?: string;
  active: boolean;
};
type SubjectRow = { id: string; code?: string; nameAr: string; nameFr?: string; active?: boolean };
type ClassSubjectRow = { classId: string; subjectId: string; coefficient: number; maxScore: number; active: boolean };
type TermRow = { id: string; nameAr: string; nameFr?: string; order: number; active: boolean };
type AssessmentRow = { id: string; classId: string; subjectId: string; termId: string; typeCode: string; title: string; date?: string; maxScore: number };
type GradeRow = { id: string; studentId: string; assessmentId: string; score: number; note?: string };
type StudentRow = {
  id: string;
  nameAr: string;
  nameFr?: string;
  gender: string;
  klass: string;
  dob?: string;
  placeOfBirth?: string;
  parentAr?: string;
  phone?: string;
  enrolled?: string;
  annualFee?: number;
  photo?: string;
  email?: string;
  branchId: string;
  active: boolean;
};
type AttendanceRow = { id: string; classId: string; studentId: string; date: string; status: string };
type WarningRow = { id: string; studentId: string; kind: string; date: string; body?: string };
type PaymentRow = { id: string; studentId: string; amount: number; date: string; note?: string };
type FeeTypeRow = { id: string; nameAr: string; amount: number; active?: boolean };
type ExpenseRow = { id: string; date: string; category: string; amount: number; note?: string; vendor?: string };
type ExamSessionRow = { id: string; termId: string; name: string; date: string };
type TimetableRow = { id: string; classId: string; day: number; slot: number; subjectId: string };
type PublishedRow = { classId: string; termId: string; published: boolean };

// ---------------------------------------------------------------------------
// Hydration bookkeeping
// ---------------------------------------------------------------------------

const CANONICAL_TYPE = "exam";
const CANONICAL_TITLE = "اختبار الفصل";

const known = {
  students: new Set<string>(),
  classes: new Set<string>(),
  subjects: new Set<string>(),
  terms: new Set<string>(),
  payments: new Set<string>(),
  warnings: new Set<string>(),
  feeTypes: new Set<string>(),
  expenses: new Set<string>(),
  examSessions: new Set<string>(),
};

let defaultBranchId: string | null = null;
let currentYearId: string | null = null;

function gradeKey(studentId: string, subjectId: string, termId: string) {
  return `${studentId}::${subjectId}::${termId}`;
}
function attKey(date: string, studentId: string) {
  return `${date}::${studentId}`;
}

// ---------------------------------------------------------------------------
// Store patch shape applied by hydrateStore
// ---------------------------------------------------------------------------

export type StorePatch = {
  students?: Student[];
  classes?: ClassSection[];
  subjects?: Subject[];
  terms?: Term[];
  grades?: Grade[];
  payments?: Payment[];
  warnings?: Warning[];
  attendance?: Record<string, AttendanceMap>;
  feeTypes?: FeeType[];
  expenses?: Expense[];
  examSessions?: ExamSession[];
  staff?: Staff[];
  timetable?: TimetableEntry[];
  publishedResults?: Record<string, boolean>;
  schoolYear?: string;
  selectedId?: string | null;
};

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const pm = new Map(prev.map((x) => [x.id, x]));
  const nm = new Map(next.map((x) => [x.id, x]));
  const added: T[] = [];
  const changed: Array<{ prev: T; next: T }> = [];
  for (const n of next) {
    const p = pm.get(n.id);
    if (!p) added.push(n);
    else if (JSON.stringify(p) !== JSON.stringify(n)) changed.push({ prev: p, next: n });
  }
  const removed = prev.filter((p) => !nm.has(p.id));
  return { added, changed, removed };
}

function sameMapKey<T>(prev: Map<string, T>, next: Map<string, T>) {
  const added: T[] = [];
  const changed: Array<{ prev: T; next: T }> = [];
  for (const [key, n] of next) {
    const p = prev.get(key);
    if (!p) added.push(n);
    else if (JSON.stringify(p) !== JSON.stringify(n)) changed.push({ prev: p, next: n });
  }
  const removed: T[] = [];
  for (const [key, p] of prev) {
    const n = next.get(key);
    if (!n) removed.push(p);
    else if (JSON.stringify(p) !== JSON.stringify(n)) changed.push({ prev: p, next: n });
  }
  return { added, changed, removed };
}

// ---------------------------------------------------------------------------
// Assessment resolution (canonical per class+subject+term)
// ---------------------------------------------------------------------------

async function resolveAssessmentId(
  classId: string,
  subjectId: string,
  termId: string,
  maxScore: number,
): Promise<string> {
  const list = await api.get<{ items: AssessmentRow[] }>(
    `/api/academic/assessments?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&termId=${encodeURIComponent(termId)}`,
  );
  if (list.ok && list.data) {
    const found = list.data.items.find((a) => a.typeCode === CANONICAL_TYPE && a.title === CANONICAL_TITLE);
    if (found) return found.id;
  }
  const created = await api.post<{ item: AssessmentRow }>("/api/academic/assessments", {
    classId,
    subjectId,
    termId,
    typeCode: CANONICAL_TYPE,
    title: CANONICAL_TITLE,
    maxScore,
  });
  if (!created.ok || !created.data?.item) {
    throw new Error(created.error ?? "assessment-create failed");
  }
  return created.data.item.id;
}

async function serverGradeId(studentId: string, assessmentId: string): Promise<string | null> {
  const list = await api.get<{ items: GradeRow[] }>(
    `/api/academic/grades?studentId=${encodeURIComponent(studentId)}&assessmentId=${encodeURIComponent(assessmentId)}`,
  );
  if (!list.ok || !list.data) return null;
  const row = list.data.items.find((g) => g.studentId === studentId);
  return row?.id ?? null;
}

/**
 * Self-healing: re-sends the student's `klass` so the server's enrollment
 * reconciliation attaches the student to the matching class before a
 * grade/attendance write is retried.
 */
async function ensureStudentEnrollment(studentId: string, student: Student | undefined): Promise<void> {
  const klass = student?.klass?.trim();
  if (klass) {
    await api.patch<{ student: StudentRow }>(`/api/students/${studentId}`, { klass });
  }
}

// ---------------------------------------------------------------------------
// Queue of async write-through operations
// ---------------------------------------------------------------------------

type Op = { label: string; run: () => Promise<unknown> };

// Mutations are synchronous at the Zustand boundary, but several can be made
// before the first network request finishes. Keep batches in order: a student
// registration must reach the server before a payment, attendance mark, or
// grade referring to it, and a class/subject link must exist before an
// assessment is created. This is deliberately a module-level promise rather
// than a debounce so no user mutation is discarded.
let writeChain: Promise<void> = Promise.resolve();

function executeOps(ops: Op[]): void {
  const batch = async () => {
    const seen = new Set<string>();
    for (const op of ops) {
      if (seen.has(op.label)) continue;
      seen.add(op.label);
      try {
        const result = await op.run();
        // `api` returns failures as values rather than rejected promises.
        if (result && typeof result === "object" && "ok" in result && (result as { ok?: unknown }).ok === false) {
          console.error(`[relational] write-through failed (${op.label}):`, result);
        }
      } catch (err) {
        console.error(`[relational] write-through failed (${op.label}):`, err);
      }
    }
  };
  // Continue processing later changes even if an unexpected failure escapes a
  // batch; individual operations above are logged with their exact label.
  writeChain = writeChain.then(batch, batch);
}

// ---------------------------------------------------------------------------
// pushChanges — the single write-through funnel
// ---------------------------------------------------------------------------

export type StoreState = {
  students: Student[];
  classes: ClassSection[];
  subjects: Subject[];
  terms: Term[];
  grades: Grade[];
  payments: Payment[];
  warnings: Warning[];
  attendance: Record<string, AttendanceMap>;
  feeTypes: FeeType[];
  expenses: Expense[];
  examSessions: ExamSession[];
  staff: Staff[];
  timetable: TimetableEntry[];
  publishedResults: Record<string, boolean>;
};

const EMPTY_STATE: StoreState = {
  students: [],
  classes: [],
  subjects: [],
  terms: [],
  grades: [],
  payments: [],
  warnings: [],
  attendance: {},
  feeTypes: [],
  expenses: [],
  examSessions: [],
  staff: [],
  timetable: [],
  publishedResults: {},
};

export function pushChanges(prevRaw: Partial<StoreState>, nextRaw: Partial<StoreState>): void {
  if (isDesktop()) return;
  const prev: StoreState = { ...EMPTY_STATE, ...prevRaw, staff: prevRaw.staff ?? [], publishedResults: prevRaw.publishedResults ?? {} };
  const next: StoreState = { ...EMPTY_STATE, ...nextRaw, staff: nextRaw.staff ?? [], publishedResults: nextRaw.publishedResults ?? {} };

  const ops: Op[] = [];

  // ---- Students ----
  const studentsDiff = diffById(prev.students, next.students);
  for (const s of studentsDiff.added) {
    if (known.students.has(s.id)) continue;
    known.students.add(s.id);
    ops.push({
      label: `student-create:${s.id}`,
      run: () =>
        api.post("/api/students", {
          id: s.id,
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          gender: s.gender,
          klass: s.klass,
          dob: s.dob,
          placeOfBirth: s.placeOfBirth,
          parentAr: s.parentAr,
          phone: s.phone,
          enrolled: s.enrolled,
          annualFee: s.annualFee,
          photo: s.photo,
          email: s.email,
          branchId: defaultBranchId ?? undefined,
        }),
    });
  }
  for (const { next: s } of studentsDiff.changed) {
    if (!known.students.has(s.id)) continue;
    ops.push({
      label: `student-update:${s.id}`,
      run: () =>
        api.patch<{ student: StudentRow }>(`/api/students/${s.id}`, {
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          gender: s.gender,
          klass: s.klass,
          dob: s.dob,
          placeOfBirth: s.placeOfBirth,
          parentAr: s.parentAr,
          phone: s.phone,
          enrolled: s.enrolled,
          annualFee: s.annualFee,
          photo: s.photo,
          email: s.email,
        }),
    });
  }
  for (const s of studentsDiff.removed) {
    if (!known.students.has(s.id)) continue;
    ops.push({ label: `student-delete:${s.id}`, run: () => api.del<{ removed: boolean }>(`/api/students/${s.id}`) });
  }

  // ---- Classes ----
  const classesDiff = diffById(prev.classes, next.classes);
  for (const c of classesDiff.added) {
    if (known.classes.has(c.id)) continue;
    known.classes.add(c.id);
    ops.push({
      label: `class-create:${c.id}`,
      run: () =>
        api.post("/api/academic/classes", {
          id: c.id,
          branchId: defaultBranchId ?? undefined,
          academicYearId: currentYearId ?? undefined,
          nameAr: c.nameAr,
          nameFr: c.nameFr,
          level: c.level,
          section: c.section,
          capacity: c.capacity,
          headTeacherUserId: c.teacherStaffId,
          active: c.active,
        }),
    });
  }
  for (const { next: c } of classesDiff.changed) {
    if (!known.classes.has(c.id)) continue;
    ops.push({
      label: `class-update:${c.id}`,
      run: () =>
        api.patch(`/api/academic/classes/${c.id}`, {
          nameAr: c.nameAr,
          nameFr: c.nameFr,
          level: c.level,
          section: c.section,
          capacity: c.capacity,
          headTeacherUserId: c.teacherStaffId,
          active: c.active,
        }),
    });
  }
  for (const c of classesDiff.removed) {
    // No relational DELETE endpoint for classes (confirmed gap): log only.
    if (known.classes.has(c.id)) {
      console.warn(`[relational] class deletion is not supported by the relational API yet: ${c.id}`);
    }
  }

  // ---- Subjects (global + per-class link) ----
  const subjectsDiff = diffById(prev.subjects, next.subjects);
  for (const s of subjectsDiff.added) {
    const knownSubject = known.subjects.has(s.id);
    if (knownSubject) {
      // Already exists relationally: just ensure the class link is present.
      if (s.classId) {
        ops.push({
          label: `class-subject-link:${s.classId}:${s.id}`,
          run: () =>
            api.post(`/api/academic/classes/${s.classId}/class-subjects`, {
              subjectId: s.id,
              coefficient: s.coefficient,
              maxScore: s.maxScore,
              active: s.active,
            }),
        });
      }
      continue;
    }
    known.subjects.add(s.id);
    ops.push({
      label: `subject-create:${s.id}`,
      run: async () => {
        const res = await api.post<{ item: SubjectRow }>("/api/academic/subjects", {
          id: s.id,
          code: s.code,
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          active: s.active,
        });
        if (!res.ok) return res;
        if (s.classId) {
          const link = await api.post(`/api/academic/classes/${s.classId}/class-subjects`, {
            subjectId: s.id,
            coefficient: s.coefficient,
            maxScore: s.maxScore,
            active: s.active,
          });
          if (!link.ok) throw new Error(link.error ?? "class-subject link failed");
        }
        return res;
      },
    });
  }
  for (const { prev: p, next: s } of subjectsDiff.changed) {
    const identityChanged =
      p.nameAr !== s.nameAr || p.nameFr !== s.nameFr || p.code !== s.code || p.active !== s.active;
    const linkChanged =
      p.classId !== s.classId || p.coefficient !== s.coefficient || p.maxScore !== s.maxScore;
    if (known.subjects.has(s.id) && identityChanged) {
      ops.push({
        label: `subject-update:${s.id}`,
        run: () =>
          api.patch(`/api/academic/subjects/${s.id}`, {
            code: s.code,
            nameAr: s.nameAr,
            nameFr: s.nameFr,
            active: s.active,
          }),
      });
    }
    if (linkChanged && known.subjects.has(s.id)) {
      if (p.classId) {
        ops.push({
          label: `class-subject-unlink:${p.classId}:${s.id}`,
          run: () => api.del(`/api/academic/classes/${p.classId}/class-subjects/${s.id}`),
        });
      }
      if (s.classId) {
        ops.push({
          label: `class-subject-link:${s.classId}:${s.id}`,
          run: () =>
            api.post(`/api/academic/classes/${s.classId}/class-subjects`, {
              subjectId: s.id,
              coefficient: s.coefficient,
              maxScore: s.maxScore,
              active: s.active,
            }),
        });
      }
    }
  }
  for (const s of subjectsDiff.removed) {
    if (s.classId && known.subjects.has(s.id)) {
      ops.push({
        label: `class-subject-unlink:${s.classId}:${s.id}`,
        run: () => api.del(`/api/academic/classes/${s.classId}/class-subjects/${s.id}`),
      });
    }
  }

  // ---- Terms ----
  const termsDiff = diffById(prev.terms, next.terms);
  for (const t of termsDiff.added) {
    if (known.terms.has(t.id)) continue;
    known.terms.add(t.id);
    ops.push({
      label: `term-create:${t.id}`,
      run: () =>
        api.post("/api/academic/terms", {
          id: t.id,
          nameAr: t.nameAr,
          nameFr: t.nameFr,
          order: t.order,
          active: t.active,
        }),
    });
  }
  for (const { next: t } of termsDiff.changed) {
    if (!known.terms.has(t.id)) continue;
    ops.push({
      label: `term-update:${t.id}`,
      run: () =>
        api.patch(`/api/academic/terms/${t.id}`, {
          nameAr: t.nameAr,
          nameFr: t.nameFr,
          order: t.order,
          active: t.active,
        }),
    });
  }
  for (const t of termsDiff.removed) {
    if (known.terms.has(t.id)) {
      ops.push({ label: `term-delete:${t.id}`, run: () => api.del(`/api/academic/terms/${t.id}`) });
    }
  }

  // ---- Grades (via canonical assessment + relational upsert) ----
  const gradesMapPrev = new Map(prev.grades.map((g) => [gradeKey(g.studentId, g.subjectId, g.termId), g]));
  const gradesMapNext = new Map(next.grades.map((g) => [gradeKey(g.studentId, g.subjectId, g.termId), g]));
  const gradeDiff = sameMapKey(gradesMapPrev, gradesMapNext);

  const studentById = new Map(next.students.map((s) => [s.id, s]));
  const prevStudentById = new Map(prev.students.map((s) => [s.id, s]));

  for (const g of gradeDiff.added) {
    const student = studentById.get(g.studentId);
    const cls = student?.classId ?? prevStudentById.get(g.studentId)?.classId;
    if (!cls) continue;
    ops.push({
      label: `grade-upsert:${gradeKey(g.studentId, g.subjectId, g.termId)}`,
      run: async () => {
        const assessmentId = await resolveAssessmentId(cls!, g.subjectId, g.termId, g.maxScore);
        if (!gradesKnownKeys.has(gradeKey(g.studentId, g.subjectId, g.termId))) {
          gradesKnownKeys.add(gradeKey(g.studentId, g.subjectId, g.termId));
        }
        const res = await api.post("/api/academic/grades", { studentId: g.studentId, assessmentId, score: g.score, note: g.note });
        if (!res.ok && res.status > 0) await ensureStudentEnrollment(g.studentId, studentById.get(g.studentId));
        return res.ok
          ? res
          : api.post("/api/academic/grades", { studentId: g.studentId, assessmentId, score: g.score, note: g.note });
      },
    });
  }
  for (const { next: g } of gradeDiff.changed) {
    const student = studentById.get(g.studentId);
    const cls = student?.classId ?? prevStudentById.get(g.studentId)?.classId;
    if (!cls) continue;
    ops.push({
      label: `grade-upsert:${gradeKey(g.studentId, g.subjectId, g.termId)}`,
      run: async () => {
        const assessmentId = await resolveAssessmentId(cls!, g.subjectId, g.termId, g.maxScore);
        const res = await api.post("/api/academic/grades", { studentId: g.studentId, assessmentId, score: g.score, note: g.note });
        if (!res.ok && res.status > 0) await ensureStudentEnrollment(g.studentId, studentById.get(g.studentId));
        return res.ok
          ? res
          : api.post("/api/academic/grades", { studentId: g.studentId, assessmentId, score: g.score, note: g.note });
      },
    });
  }
  for (const g of gradeDiff.removed) {
    const student = prevStudentById.get(g.studentId);
    const cls = student?.classId ?? studentById.get(g.studentId)?.classId;
    if (!cls) continue;
    ops.push({
      label: `grade-delete:${gradeKey(g.studentId, g.subjectId, g.termId)}`,
      run: async () => {
        const assessmentId = await resolveAssessmentId(cls!, g.subjectId, g.termId, g.maxScore);
        const serverId = await serverGradeId(g.studentId, assessmentId);
        if (serverId) return api.del(`/api/academic/grades/${serverId}`);
        return null;
      },
    });
  }

  // ---- Attendance ----
  const attKeys = new Set<string>();
  for (const [date, dayMap] of Object.entries(prev.attendance ?? {})) {
    for (const sid of Object.keys(dayMap)) attKeys.add(attKey(date, sid));
  }
  for (const [date, dayMap] of Object.entries(next.attendance ?? {})) {
    for (const sid of Object.keys(dayMap)) attKeys.add(attKey(date, sid));
  }
  for (const key of attKeys) {
    const idx = key.indexOf("::");
    const date = key.slice(0, idx);
    const sid = key.slice(idx + 2);
    const prevStatus = prev.attendance?.[date]?.[sid];
    const nextStatus = next.attendance?.[date]?.[sid];
    if (prevStatus === nextStatus) continue;
    if (nextStatus) {
      const student = studentById.get(sid);
      const cls = student?.classId ?? prevStudentById.get(sid)?.classId;
      if (!cls) continue;
      ops.push({
        label: `attendance-mark:${key}`,
        run: async () => {
          const res = await api.post<{ item: AttendanceRow }>("/api/academic/attendance", {
            classId: cls!,
            studentId: sid,
            date,
            status: nextStatus,
          });
          if (res.ok) return res;
          if (res.status > 0) {
            await ensureStudentEnrollment(sid, studentById.get(sid) ?? prevStudentById.get(sid));
            return api.post("/api/academic/attendance", {
              classId: cls!,
              studentId: sid,
              date,
              status: nextStatus,
            });
          }
          return res;
        },
      });
    } else {
      const student = prevStudentById.get(sid);
      const cls = student?.classId ?? studentById.get(sid)?.classId;
      if (!cls) continue;
      ops.push({
        label: `attendance-remove:${key}`,
        run: async () => {
          const list = await api.get<{ items: AttendanceRow[] }>(
            `/api/academic/attendance?classId=${encodeURIComponent(cls!)}&date=${encodeURIComponent(date)}`,
          );
          const row = list.data?.items.find((a) => a.studentId === sid);
          if (row) return api.del(`/api/academic/attendance/${row.id}`);
          return null;
        },
      });
    }
  }

  // ---- Payments / Warnings / Fee types / Expenses / Exam sessions ----
  const paymentsDiff = diffById(prev.payments, next.payments);
  for (const p of paymentsDiff.added) {
    if (known.payments.has(p.id)) continue;
    known.payments.add(p.id);
    ops.push({
      label: `payment-create:${p.id}`,
      run: () =>
        api.post("/api/finance/payments", {
          id: p.id,
          studentId: p.studentId,
          branchId: defaultBranchId ?? undefined,
          amount: p.amount,
          date: p.date,
          note: p.note,
        }),
    });
  }
  for (const p of paymentsDiff.removed) {
    if (known.payments.has(p.id)) {
      ops.push({ label: `payment-delete:${p.id}`, run: () => api.del(`/api/finance/payments/${p.id}`) });
    }
  }

  const warningsDiff = diffById(prev.warnings, next.warnings);
  for (const w of warningsDiff.added) {
    if (known.warnings.has(w.id)) continue;
    known.warnings.add(w.id);
    ops.push({
      label: `warning-create:${w.id}`,
      run: () =>
        api.post("/api/academic/warnings", {
          id: w.id,
          studentId: w.studentId,
          branchId: defaultBranchId ?? undefined,
          kind: w.kind,
          date: w.date,
          body: w.body,
        }),
    });
  }
  for (const w of warningsDiff.removed) {
    if (known.warnings.has(w.id)) {
      ops.push({ label: `warning-delete:${w.id}`, run: () => api.del(`/api/academic/warnings/${w.id}`) });
    }
  }

  const feeTypesDiff = diffById(prev.feeTypes, next.feeTypes);
  for (const f of feeTypesDiff.added) {
    if (known.feeTypes.has(f.id)) continue;
    known.feeTypes.add(f.id);
    ops.push({
      label: `fee-type-create:${f.id}`,
      run: () =>
        api.post("/api/finance/fee-types", {
          id: f.id,
          branchId: defaultBranchId ?? undefined,
          nameAr: f.nameAr,
          amount: f.amount,
        }),
    });
  }
  for (const f of feeTypesDiff.removed) {
    if (known.feeTypes.has(f.id)) {
      ops.push({ label: `fee-type-delete:${f.id}`, run: () => api.del(`/api/finance/fee-types/${f.id}`) });
    }
  }

  const expensesDiff = diffById(prev.expenses, next.expenses);
  for (const e of expensesDiff.added) {
    if (known.expenses.has(e.id)) continue;
    known.expenses.add(e.id);
    ops.push({
      label: `expense-create:${e.id}`,
      run: () =>
        api.post("/api/finance/expenses", {
          id: e.id,
          branchId: defaultBranchId ?? undefined,
          date: e.date,
          category: e.category,
          amount: e.amount,
          note: e.note,
          vendor: e.vendor,
        }),
    });
  }
  for (const e of expensesDiff.removed) {
    if (known.expenses.has(e.id)) {
      ops.push({ label: `expense-delete:${e.id}`, run: () => api.del(`/api/finance/expenses/${e.id}`) });
    }
  }

  const examSessionsDiff = diffById(prev.examSessions, next.examSessions);
  for (const s of examSessionsDiff.added) {
    if (known.examSessions.has(s.id)) continue;
    known.examSessions.add(s.id);
    ops.push({
      label: `exam-session-create:${s.id}`,
      run: () =>
        api.post("/api/academic/exam-sessions", {
          id: s.id,
          branchId: defaultBranchId ?? undefined,
          termId: s.termId,
          name: s.name,
          date: s.date,
        }),
    });
  }
  for (const s of examSessionsDiff.removed) {
    if (known.examSessions.has(s.id)) {
      ops.push({ label: `exam-session-delete:${s.id}`, run: () => api.del(`/api/academic/exam-sessions/${s.id}`) });
    }
  }

  // ---- Timetable ----
  const timetableDiff = diffById(prev.timetable, next.timetable);
  for (const t of timetableDiff.added) {
    ops.push({
      label: `timetable-upsert:${t.classId}:${t.day}:${t.slot}`,
      run: () =>
        api.post(`/api/academic/classes/${t.classId}/timetable`, { day: t.day, slot: t.slot, subjectId: t.subjectId }),
    });
  }
  for (const t of timetableDiff.removed) {
    ops.push({
      label: `timetable-delete:${t.id}`,
      run: () => api.del(`/api/academic/classes/${t.classId}/timetable/${t.id}`),
    });
  }

  // ---- Published results ----
  const resultsPrev = new Map(Object.entries(prev.publishedResults ?? {}));
  const resultsNext = new Map(Object.entries(next.publishedResults ?? {}));
  for (const [key, published] of resultsNext) {
    if (resultsPrev.get(key) === published) continue;
    const idx = key.indexOf("::");
    if (idx <= 0) continue;
    const classId = key.slice(0, idx);
    const termId = key.slice(idx + 2);
    ops.push({
      label: `results-publish:${key}`,
      run: () =>
        api.post(`/api/academic/classes/${classId}/results`, { termId, published }),
    });
  }

  executeOps(ops);
}

const gradesKnownKeys = new Set<string>();

// ---------------------------------------------------------------------------
// hydrateStore — replace the UI cache from the relational APIs
// ---------------------------------------------------------------------------

export async function hydrateStore(apply: (patch: StorePatch) => void): Promise<void> {
  if (isDesktop()) return;
  try {
    const branchRes = await api.get<{ branches: BranchRow[] }>("/api/branches");
    if (!branchRes.ok || !branchRes.data) throw new Error("branches fetch failed");
    const branches = branchRes.data.branches;
    defaultBranchId = branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? null;

    const yearRes = await api.get<{ items: YearRow[] }>("/api/academic/years");
    const years = yearRes.ok && yearRes.data ? yearRes.data.items : [];
    currentYearId = years.find((y) => y.isCurrent)?.id ?? null;
    const yearLabel = years.find((y) => y.isCurrent)?.label;

    const termRes = await api.get<{ items: TermRow[] }>("/api/academic/terms");
    const terms = (termRes.ok && termRes.data ? termRes.data.items : []).map<Term>((t) => ({
      id: t.id,
      nameAr: t.nameAr,
      nameFr: t.nameFr,
      order: t.order,
      active: t.active,
    }));
    known.terms.clear();
    terms.forEach((t) => known.terms.add(t.id));

    const studRes = await api.get<{ items: StudentRow[] }>("/api/students?includeInactive=1");
    if (!studRes.ok || !studRes.data) throw new Error("students fetch failed");

    const clsRes = await api.get<{ items: ClassRow[] }>("/api/academic/classes?includeInactive=1");
    if (!clsRes.ok || !clsRes.data) throw new Error("classes fetch failed");
    const classes = clsRes.data.items.map<ClassSection>((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      nameFr: c.nameFr,
      branchId: c.branchId,
      level: c.level,
      section: c.section,
      capacity: c.capacity,
      teacherStaffId: c.headTeacherUserId,
      active: c.active,
    }));
    known.classes.clear();
    classes.forEach((c) => known.classes.add(c.id));

    const firstClassIdByName = new Map<string, string>();
    for (const c of classes) {
      if (!firstClassIdByName.has(c.nameAr)) firstClassIdByName.set(c.nameAr, c.id);
    }

    const subjRes = await api.get<{ items: SubjectRow[] }>("/api/academic/subjects?includeInactive=1");
    const subjectsList = subjRes.ok && subjRes.data ? subjRes.data.items : [];

    const subjects: Subject[] = [];
    known.subjects.clear();
    for (const cls of classes) {
      const csRes = await api.get<{ items: ClassSubjectRow[] }>(`/api/academic/classes/${cls.id}/class-subjects`);
      if (!csRes.ok || !csRes.data) continue;
      for (const cs of csRes.data.items) {
        known.subjects.add(cs.subjectId);
        const info = subjectsList.find((s) => s.id === cs.subjectId);
        subjects.push({
          id: cs.subjectId,
          nameAr: info?.nameAr ?? cs.subjectId,
          nameFr: info?.nameFr,
          code: info?.code,
          classId: cls.id,
          coefficient: cs.coefficient,
          maxScore: cs.maxScore,
          active: cs.active,
        });
      }
    }

    const students: Student[] = studRes.data.items.map<Student>((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameFr: s.nameFr ?? "",
      gender: (s.gender as Student["gender"]) ?? "male",
      klass: s.klass ?? "",
      classId: s.klass ? firstClassIdByName.get(s.klass) ?? undefined : undefined,
      dob: s.dob ?? "",
      placeOfBirth: s.placeOfBirth ?? "",
      parentAr: s.parentAr ?? "",
      phone: s.phone ?? "",
      enrolled: s.enrolled ?? "",
      annualFee: s.annualFee ?? 0,
      photo: s.photo,
      email: s.email,
      branchId: s.branchId,
    }));
    known.students.clear();
    students.forEach((s) => known.students.add(s.id));

    const teacherRes = await api.get<{ teachers: TeacherRow[] }>("/api/teachers");
    const staff: Staff[] = (teacherRes.ok && teacherRes.data ? teacherRes.data.teachers : []).map<Staff>((t) => ({
      id: t.id,
      nameAr: t.nameAr,
      role: "teacher",
      phone: "",
    }));

    const gradingRes = await Promise.all([
      api.get<{ items: AssessmentRow[] }>("/api/academic/assessments"),
      api.get<{ items: GradeRow[] }>("/api/academic/grades"),
    ]);
    const assessments = gradingRes[0].ok && gradingRes[0].data ? gradingRes[0].data.items : [];
    const gradeRows = gradingRes[1].ok && gradingRes[1].data ? gradingRes[1].data.items : [];
    const assessmentById = new Map(assessments.map((a) => [a.id, a]));
    const grades: Grade[] = [];
    gradesKnownKeys.clear();
    for (const g of gradeRows) {
      const a = assessmentById.get(g.assessmentId);
      if (!a) continue;
      grades.push({
        id: g.id,
        studentId: g.studentId,
        subjectId: a.subjectId,
        termId: a.termId,
        score: g.score,
        maxScore: a.maxScore,
        date: a.date,
        note: g.note,
      });
      gradesKnownKeys.add(gradeKey(g.studentId, a.subjectId, a.termId));
    }

    const attendance: Record<string, AttendanceMap> = {};
    for (const cls of classes) {
      const attRes = await api.get<{ items: AttendanceRow[] }>(`/api/academic/attendance?classId=${cls.id}`);
      if (!attRes.ok || !attRes.data) continue;
      for (const a of attRes.data.items) {
        const day = attendance[a.date] ?? {};
        day[a.studentId] = a.status as AttendanceMap[string];
        attendance[a.date] = day;
      }
    }

    const financeRes = await Promise.all([
      api.get<{ items: PaymentRow[] }>("/api/finance/payments"),
      api.get<{ items: WarningRow[] }>("/api/academic/warnings"),
      api.get<{ items: FeeTypeRow[] }>("/api/finance/fee-types?includeInactive=1"),
      api.get<{ items: ExpenseRow[] }>("/api/finance/expenses"),
      api.get<{ items: ExamSessionRow[] }>("/api/academic/exam-sessions"),
    ]);
    const payments = (financeRes[0].ok && financeRes[0].data) ? financeRes[0].data.items.map<Payment>((p) => ({
      id: p.id,
      studentId: p.studentId,
      amount: p.amount,
      date: p.date,
      note: p.note ?? "",
    })) : [];
    const warnings = (financeRes[1].ok && financeRes[1].data) ? financeRes[1].data.items.map<Warning>((w) => ({
      id: w.id,
      studentId: w.studentId,
      kind: (w.kind as Warning["kind"]) ?? "absence",
      date: w.date,
      body: w.body ?? "",
    })) : [];
    const feeTypes = (financeRes[2].ok && financeRes[2].data) ? financeRes[2].data.items.map<FeeType>((f) => ({
      id: f.id,
      nameAr: f.nameAr,
      amount: f.amount,
      active: f.active ?? true,
    })) : [];
    const expenses = (financeRes[3].ok && financeRes[3].data) ? financeRes[3].data.items.map<Expense>((e) => ({
      id: e.id,
      date: e.date,
      category: e.category,
      amount: e.amount,
      note: e.note ?? "",
      vendor: e.vendor,
    })) : [];
    const examSessions = (financeRes[4].ok && financeRes[4].data) ? financeRes[4].data.items.map<ExamSession>((s) => ({
      id: s.id,
      termId: s.termId,
      name: s.name,
      date: s.date,
    })) : [];
    known.payments.clear();
    payments.forEach((p) => known.payments.add(p.id));
    known.warnings.clear();
    warnings.forEach((w) => known.warnings.add(w.id));
    known.feeTypes.clear();
    feeTypes.forEach((f) => known.feeTypes.add(f.id));
    known.expenses.clear();
    expenses.forEach((e) => known.expenses.add(e.id));
    known.examSessions.clear();
    examSessions.forEach((s) => known.examSessions.add(s.id));

    const timetable: TimetableEntry[] = [];
    for (const cls of classes) {
      const ttRes = await api.get<{ items: TimetableRow[] }>(`/api/academic/classes/${cls.id}/timetable`);
      if (!ttRes.ok || !ttRes.data) continue;
      for (const t of ttRes.data.items) {
        timetable.push({ id: t.id, classId: t.classId, day: t.day, slot: t.slot, subjectId: t.subjectId });
      }
    }

    const publishedResults: Record<string, boolean> = {};
    for (const cls of classes) {
      const rRes = await api.get<{ items: PublishedRow[] }>(`/api/academic/classes/${cls.id}/results`);
      if (!rRes.ok || !rRes.data) continue;
      for (const r of rRes.data.items) {
        publishedResults[`${r.classId}::${r.termId}`] = r.published;
      }
    }

    const selectedId = students[0]?.id ?? null;

    apply({
      students,
      classes,
      subjects,
      terms,
      grades,
      staff,
      payments,
      warnings,
      attendance,
      feeTypes,
      expenses,
      examSessions,
      timetable,
      publishedResults,
      schoolYear: yearLabel ?? undefined,
      selectedId,
    });
  } catch (err) {
    console.error("[relational] hydration failed — store remains empty:", err);
  }
}
