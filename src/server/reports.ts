/**
 * Relational reports (Phase 3): report cards, class student lists and
 * admission documents, generated exclusively from the PostgreSQL academic
 * and student tables — never from the legacy JSON document store.
 *
 * Calculation rules (ported 1:1 from the existing academic logic, documented
 * here because the legacy originals operate on the old document store):
 * - per-assessment percentage  = score / maxScore * 100
 * - per-subject average (/20)  = arithmetic mean of scored normalized
 *   assessment scores * 20  (generalizes the legacy single-grade bulletin,
 *   which used exactly one grade per subject: normalized * 20)
 * - weighted points           = subjectAvg20 * coefficient
 *   (identical to `weightedPoints` in `lib/print.ts`)
 * - overall average (/20)     = Σ(weighted) / Σ(coefficients)
 *   (identical to legacy `computeBulletin`)
 * - appreciation              = `getAppreciation` bands (`lib/constants.ts`)
 * - rank                      = class rank by term average, descending, ties
 *   share the same rank (identical to legacy `computeClassRanking`)
 *
 * Visibility rule (mirrors the student portal): grades appear only for
 * terms whose bulletin is published for the class (`published_results`).
 * Unpublished terms return the subject/assessment structure with null
 * scores so the UI can state "not published" instead of inventing data.
 *
 * Server-only module — never import from client code.
 */
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { requireBranchAccess, requireBranchId } from "./scope";
import { getAppreciation } from "@/lib/constants";
import type { SafeUser } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Payload shapes (serializable, client-safe — no hashes, no passwords)
// ---------------------------------------------------------------------------

export type ReportAssessment = {
  id: string;
  title: string;
  typeCode: string;
  date?: string;
  maxScore: number;
  score: number | null;
  percent: number | null;
};

export type ReportSubject = {
  subjectId: string;
  nameAr: string;
  coefficient: number;
  maxScore: number;
  teacherNameAr?: string;
  note?: string;
  assessments: ReportAssessment[];
  /** Mean of scored normalized assessments, on /20. Null when nothing scored. */
  average20: number | null;
  weightedPoints: number | null;
  appreciation: string | null;
};

export type ReportCard = {
  student: {
    id: string;
    nameAr: string;
    nameFr: string;
    gender: string;
    dob: string;
    klass: string;
    enrolled: string;
  };
  branch: { id: string; nameAr: string };
  class: { id: string; nameAr: string };
  academicYear: { id: string; label: string };
  term: { id: string; nameAr: string };
  published: boolean;
  subjects: ReportSubject[];
  totalWeighted: number | null;
  totalCoefficient: number;
  average20: number | null;
  percentage: number | null;
  appreciation: string | null;
  /** 1-based class rank for the term (ties share rank). Null when unpublished. */
  rank: number | null;
  classSize: number;
};

export type ClassListEntry = {
  id: string;
  nameAr: string;
  nameFr: string;
  gender: string;
  klass: string;
  enrolled: string;
  status: string;
};

export type ClassStudentList = {
  branch: { id: string; nameAr: string };
  class: { id: string; nameAr: string };
  academicYear: { id: string; label: string };
  students: ClassListEntry[];
};

export type AdmissionDocument = {
  reference: string;
  student: {
    id: string;
    nameAr: string;
    nameFr: string;
    gender: string;
    dob: string;
    placeOfBirth: string;
    parentAr: string;
    phone: string;
    enrolled: string;
    annualFee: number;
  };
  branch: { id: string; nameAr: string };
  className: string;
  /** Portal login username when a bound login exists. Never a password. */
  loginUsername: string | null;
  /** Parent portal login username when a bound parent login exists. Never a password. */
  parentLoginUsername: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Stable `PREFIX-YYYY-NNNN` reference (same rule as `officialDocNo`). */
function docRef(prefix: string, isoDate: string, recordId: string, siblings: Array<{ id: string; date: string }>): string {
  const year = /^\d{4}$/.test(isoDate.slice(0, 4)) ? isoDate.slice(0, 4) : String(new Date().getFullYear());
  const ordered = siblings
    .filter((x) => /^\d{4}$/.test(x.date.slice(0, 4)) && x.date.slice(0, 4) === year)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let idx = ordered.findIndex((x) => x.id === recordId) + 1;
  if (idx <= 0) {
    let h = 0;
    for (let i = 0; i < recordId.length; i++) h = (h * 31 + recordId.charCodeAt(i)) >>> 0;
    idx = (h % 9000) + 1;
  }
  return `${prefix}-${year}-${String(idx).padStart(4, "0")}`;
}

async function requireStudentRow(db: Awaited<ReturnType<typeof getDb>>, studentId: string): Promise<DbRow> {
  const res = await db.query(
    `SELECT s.id, s.name_ar, s.name_fr, s.gender, s.klass, s.dob, s.place_of_birth,
            s.parent_ar, s.phone, s.enrolled, s.annual_fee, s.email, s.branch_id, s.active,
            b.name_ar AS branch_name_ar
     FROM students s JOIN branches b ON b.id = s.branch_id
     WHERE s.id = $1 LIMIT 1`,
    [studentId],
  );
  if (res.rows.length === 0) throw new ApiError("الطالب غير موجود", 404);
  return res.rows[0];
}

async function requireTermRow(db: Awaited<ReturnType<typeof getDb>>, termId: string): Promise<DbRow> {
  const res = await db.query('SELECT id, name_ar, "order", active FROM terms WHERE id = $1 LIMIT 1', [termId]);
  if (res.rows.length === 0) throw new ApiError("الفصل الدراسي غير موجود", 404);
  return res.rows[0];
}

/** Current (open) class enrollment of a student, if any. */
async function currentEnrollment(
  db: Awaited<ReturnType<typeof getDb>>,
  studentId: string,
): Promise<{ classId: string; classNameAr: string; academicYearId: string; yearLabel: string } | null> {
  const res = await db.query(
    `SELECT e.class_id, c.name_ar AS class_name_ar, e.academic_year_id, ay.label AS year_label
     FROM student_class_enrollments e
     JOIN classes c ON c.id = e.class_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     WHERE e.student_id = $1 AND e.is_current = true AND e.status = 'enrolled'
     LIMIT 1`,
    [studentId],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    classId: String(r.class_id),
    classNameAr: String(r.class_name_ar),
    academicYearId: String(r.academic_year_id),
    yearLabel: String(r.year_label),
  };
}

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

/**
 * Students may only ever read their OWN documents: branch-scope membership
 * alone must never let one student read a classmate's grades or identity
 * papers. The student portal reads through `/api/student`, not these routes.
 */
function requireNotOtherStudent(actor: SafeUser, studentId: string): void {
  if (actor.role === "student" && actor.studentId !== studentId) {
    throw new ApiError("غير مصرح لك بالوصول إلى بيانات طالب آخر", 403);
  }
}

/**
 * Builds one student's bulletin for one term from relational data.
 * Branch is resolved from the student record itself; the actor must have
 * branch access (super_admin = ALL, heads/members/teachers via scope).
 */
export async function getReportCard(studentId: string, termId: string, actor: SafeUser): Promise<ReportCard> {
  requireBranchId(studentId);
  requireBranchId(termId);
  requireNotOtherStudent(actor, studentId);
  const db = await getDb();
  const student = await requireStudentRow(db, studentId);
  const branchId = String(student.branch_id);
  await requireBranchAccess(actor, branchId);
  // Students may read only their own bulletin (branch scope alone would
  // expose every classmate's grades).
  if (actor.role === "student" && actor.studentId !== studentId) {
    throw new ApiError("غير مصرح لك بالاطلاع على كشف طالب آخر", 403);
  }
  const term = await requireTermRow(db, termId);

  const enrollment = await currentEnrollment(db, studentId);
  const classId = enrollment?.classId ?? null;

  const subjects: ReportSubject[] = [];
  let published = false;
  let rank: number | null = null;
  let classSize = 0;

  if (classId) {
    const pub = await db.query("SELECT published FROM published_results WHERE class_id = $1 AND term_id = $2", [
      classId,
      termId,
    ]);
    published = pub.rows.length > 0 && Boolean(pub.rows[0].published);

    // Active subjects of the class with coefficients.
    const subRes = await db.query(
      `SELECT s.id, s.name_ar, cs.coefficient, cs.max_score
       FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
       WHERE cs.class_id = $1 AND cs.active = true AND s.active = true
       ORDER BY s.name_ar ASC`,
      [classId],
    );

    // All assessments of this class+term in one query (no N+1).
    const asRes = await db.query(
      `SELECT id, subject_id, type_code, title, date, max_score
       FROM assessments WHERE class_id = $1 AND term_id = $2
       ORDER BY subject_id ASC, created_at ASC, id ASC`,
      [classId, termId],
    );
    const bySubject = new Map<string, DbRow[]>();
    for (const row of asRes.rows) {
      const key = String(row.subject_id);
      const list = bySubject.get(key) ?? [];
      list.push(row);
      bySubject.set(key, list);
    }

    // The student's grades for those assessments in one query.
    const assessmentIds = asRes.rows.map((r) => String(r.id));
    const gradeMap = new Map<string, { score: number; note: string }>();
    if (assessmentIds.length > 0) {
      const gRes = await db.query(
        "SELECT assessment_id, score, note FROM grades WHERE student_id = $1 AND assessment_id = ANY($2::text[])",
        [studentId, assessmentIds],
      );
      for (const row of gRes.rows) {
        gradeMap.set(String(row.assessment_id), { score: num(row.score), note: str(row.note) });
      }
    }

    // Teacher per subject (workload view of teaching_assignments).
    const teachMap = new Map<string, string>();
    if (enrollment) {
      const tRes = await db.query(
        `SELECT ta.subject_id, u.name_ar AS teacher_name
         FROM teaching_assignments ta JOIN users u ON u.id = ta.teacher_user_id
         WHERE ta.class_id = $1 AND ta.academic_year_id = $2`,
        [classId, enrollment.academicYearId],
      );
      for (const row of tRes.rows) teachMap.set(String(row.subject_id), String(row.teacher_name));
    }

    for (const s of subRes.rows) {
      const sid = String(s.id);
      const coef = num(s.coefficient, 1);
      const rows = (bySubject.get(sid) ?? []).map((a) => {
        const g = gradeMap.get(String(a.id));
        const max = num(a.max_score, num(s.max_score, 20));
        const score = published && g ? g.score : null;
        return {
          id: String(a.id),
          title: String(a.title),
          typeCode: String(a.type_code),
          date: a.date ? String(a.date) : undefined,
          maxScore: max,
          score,
          percent: score === null || max <= 0 ? null : (score / max) * 100,
        } as ReportAssessment;
      });
      const scored = rows.filter((r) => r.score !== null);
      const avg20 =
        published && scored.length > 0
          ? scored.reduce((sum, r) => sum + (r.score as number) / (r.maxScore || 1), 0) / scored.length * 20
          : null;
      const notes = [...gradeMap.entries()]
        .filter(([aid]) => (bySubject.get(sid) ?? []).some((a) => String(a.id) === aid))
        .map(([, g]) => g.note)
        .find((n) => n.trim().length > 0);
      subjects.push({
        subjectId: sid,
        nameAr: String(s.name_ar),
        coefficient: coef,
        maxScore: num(s.max_score, 20),
        teacherNameAr: teachMap.get(sid),
        note: notes,
        assessments: rows,
        average20: avg20,
        weightedPoints: avg20 === null ? null : avg20 * coef,
        appreciation: avg20 === null ? null : getAppreciation(avg20),
      });
    }

    // Class rank over the same published data (ported ranking rule).
    const enrRes = await db.query(
      `SELECT e.student_id FROM student_class_enrollments e
       JOIN students st ON st.id = e.student_id
       WHERE e.class_id = $1 AND e.is_current = true AND e.status = 'enrolled' AND st.active = true`,
      [classId],
    );
    const classStudentIds = enrRes.rows.map((r) => String(r.student_id));
    classSize = classStudentIds.length;
    if (published && assessmentIds.length > 0 && classStudentIds.length > 0) {
      const allGrades = await db.query(
        `SELECT g.student_id, g.score, a.subject_id, a.max_score, cs.coefficient
         FROM grades g
         JOIN assessments a ON a.id = g.assessment_id
         JOIN class_subjects cs ON cs.class_id = a.class_id AND cs.subject_id = a.subject_id AND cs.active = true
         WHERE g.student_id = ANY($1::text[]) AND a.id = ANY($2::text[])`,
        [classStudentIds, assessmentIds],
      );
      const perSubject = new Map<string, Map<string, number[]>>();
      for (const row of allGrades.rows) {
        const sid = String(row.student_id);
        const max = num(row.max_score, 20);
        if (max <= 0) continue;
        let m = perSubject.get(sid);
        if (!m) {
          m = new Map();
          perSubject.set(sid, m);
        }
        const key = `${String(row.subject_id)}::${num(row.coefficient, 1)}`;
        const list = m.get(key) ?? [];
        list.push(num(row.score) / max);
        m.set(key, list);
      }
      // Every enrolled student ranks (ungraded students average 0, exactly
      // like the legacy bulletin which yields average 0 without grades).
      const averages = classStudentIds.map((sid) => {
        const m = perSubject.get(sid);
        if (!m) return { sid, avg: 0 };
        let w = 0;
        let c = 0;
        for (const [key, list] of m) {
          const coef = Number(key.split("::")[1] ?? "1");
          const mean = list.reduce((a, b) => a + b, 0) / list.length;
          w += mean * coef;
          c += coef;
        }
        return { sid, avg: c > 0 ? (w / c) * 20 : 0 };
      });
      averages.sort((a, b) => b.avg - a.avg);
      let r = 0;
      let last = Number.POSITIVE_INFINITY;
      const rankOf = new Map<string, number>();
      for (let i = 0; i < averages.length; i++) {
        if (averages[i].avg !== last) {
          r = i + 1;
          last = averages[i].avg;
        }
        rankOf.set(averages[i].sid, r);
      }
      rank = rankOf.get(studentId) ?? null;
    }
  }

  const scoredSubjects = subjects.filter((s) => s.average20 !== null);
  const totalWeighted = scoredSubjects.reduce((sum, s) => sum + (s.weightedPoints ?? 0), 0);
  const totalCoefficient = scoredSubjects.reduce((sum, s) => sum + s.coefficient, 0);
  const average20 = totalCoefficient > 0 ? totalWeighted / totalCoefficient : null;

  return {
    student: {
      id: String(student.id),
      nameAr: String(student.name_ar),
      nameFr: String(student.name_fr ?? ""),
      gender: String(student.gender ?? ""),
      dob: String(student.dob ?? ""),
      klass: enrollment?.classNameAr ?? String(student.klass ?? ""),
      enrolled: String(student.enrolled ?? ""),
    },
    branch: { id: branchId, nameAr: String(student.branch_name_ar ?? "") },
    class: { id: classId ?? "", nameAr: enrollment?.classNameAr ?? "" },
    academicYear: {
      id: enrollment?.academicYearId ?? "",
      label: enrollment?.yearLabel ?? "",
    },
    term: { id: String(term.id), nameAr: String(term.name_ar) },
    published,
    subjects,
    totalWeighted: average20 === null ? null : totalWeighted,
    totalCoefficient,
    average20,
    percentage: average20 === null ? null : (average20 / 20) * 100,
    appreciation: average20 === null ? null : getAppreciation(average20),
    rank,
    classSize,
  };
}

// ---------------------------------------------------------------------------
// Class student list
// ---------------------------------------------------------------------------

/**
 * Printable roster of a class: currently enrolled students ordered by name
 * (same ordering convention as the student directory). Branch is resolved
 * from the class itself — never trusted from the client.
 */
export async function getClassStudentList(classId: string, actor: SafeUser): Promise<ClassStudentList> {
  requireBranchId(classId);
  if (actor.role === "student") {
    throw new ApiError("غير مصرح لك بالوصول إلى قوائم الفصول", 403);
  }
  const db = await getDb();
  const cls = await db.query(
    `SELECT c.id, c.branch_id, b.name_ar AS branch_name_ar, c.name_ar, c.academic_year_id, ay.label AS year_label
     FROM classes c
     JOIN branches b ON b.id = c.branch_id
     JOIN academic_years ay ON ay.id = c.academic_year_id
     WHERE c.id = $1 LIMIT 1`,
    [classId],
  );
  if (cls.rows.length === 0) throw new ApiError("الفصل غير موجود", 404);
  const row = cls.rows[0];
  await requireBranchAccess(actor, String(row.branch_id));
  const res = await db.query(
    `SELECT s.id, s.name_ar, s.name_fr, s.gender, s.klass, s.enrolled, e.status
     FROM student_class_enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.class_id = $1 AND e.is_current = true AND e.status = 'enrolled' AND s.active = true
     ORDER BY s.name_ar ASC, s.id ASC`,
    [classId],
  );
  return {
    branch: { id: String(row.branch_id), nameAr: String(row.branch_name_ar) },
    class: { id: String(row.id), nameAr: String(row.name_ar) },
    academicYear: { id: String(row.academic_year_id), label: String(row.year_label) },
    students: res.rows.map((r) => ({
      id: String(r.id),
      nameAr: String(r.name_ar),
      nameFr: String(r.name_fr ?? ""),
      gender: String(r.gender ?? ""),
      klass: String(r.klass ?? ""),
      enrolled: String(r.enrolled ?? ""),
      status: String(r.status),
    })),
  };
}

// ---------------------------------------------------------------------------
// Admission document
// ---------------------------------------------------------------------------

/**
 * Admission/registration document for one student: identity + branch + class
 * + reference number + portal login username when a bound login exists.
 * Passwords are never included (they exist only transiently at creation).
 */
export async function getAdmissionDocument(studentId: string, actor: SafeUser): Promise<AdmissionDocument> {
  requireBranchId(studentId);
  requireNotOtherStudent(actor, studentId);
  const db = await getDb();
  const student = await requireStudentRow(db, studentId);
  const branchId = String(student.branch_id);
  await requireBranchAccess(actor, branchId);
  // Same self-only rule as the report card: no peeking at other files.
  if (actor.role === "student" && actor.studentId !== studentId) {
    throw new ApiError("غير مصرح لك بالاطلاع على ملف طالب آخر", 403);
  }
  const enrollment = await currentEnrollment(db, studentId);

  const login = await db.query("SELECT email FROM users WHERE student_id = $1 AND role = 'student' LIMIT 1", [
    studentId,
  ]);
  const parentLogin = await db.query("SELECT email FROM users WHERE parent_student_id = $1 AND role = 'parent' LIMIT 1", [
    studentId,
  ]);

  const enrolled = String(student.enrolled ?? "");
  const siblings = await db.query("SELECT id, enrolled FROM students WHERE branch_id = $1 AND active = true", [
    branchId,
  ]);
  const reference = docRef(
    "ADM",
    enrolled || new Date().toISOString().slice(0, 10),
    String(student.id),
    siblings.rows.map((r) => ({ id: String(r.id), date: String(r.enrolled ?? "") })),
  );

  return {
    reference,
    student: {
      id: String(student.id),
      nameAr: String(student.name_ar),
      nameFr: String(student.name_fr ?? ""),
      gender: String(student.gender ?? ""),
      dob: String(student.dob ?? ""),
      placeOfBirth: String(student.place_of_birth ?? ""),
      parentAr: String(student.parent_ar ?? ""),
      phone: String(student.phone ?? ""),
      enrolled,
      annualFee: num(student.annual_fee),
    },
    branch: { id: branchId, nameAr: String(student.branch_name_ar ?? "") },
    className: enrollment?.classNameAr ?? String(student.klass ?? ""),
    loginUsername: login.rows.length > 0 ? String(login.rows[0].email) : null,
    parentLoginUsername: parentLogin.rows.length > 0 ? String(parentLogin.rows[0].email) : null,
  };
}
