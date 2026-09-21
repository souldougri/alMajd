/**
 * Live end-to-end verification of the Phase 3 relational reports.
 *
 * Requires the dev server running locally (npm run dev, port 8080) with the
 * local PGlite database. NEVER run this against a production/Neon URL.
 *
 * Proves, against the real HTTP API:
 *  - report-card mathematics (per-assessment %, per-subject /20 averages with
 *    coefficients, overall weighted average, percentage, appreciation bands,
 *    class ranking with shared-rank ties, zero-grade students ranked last)
 *  - unpublished terms expose structure only (no scores, no average, no rank)
 *  - term isolation (grades of term B never leak into the term A report)
 *  - class student list (membership, no duplicates, empty class)
 *  - admission document (identity, reference format, no password material)
 *  - authorization: super_admin 200, own-branch Head 200, cross-branch Head
 *    403, unauthenticated 401, inactive Head 403, head cannot create staff
 *    accounts or disable logins, head can create a bound student login only
 *    in his own branch
 *
 * Fixture (deterministic):
 *   Branch B1 "فرع إثبات التقارير", class "فصل الإثبات أ" in the current year.
 *   Subject S1 coefficient 2 (assessments A1/20, A2/40), S2 coefficient 1 (A3/20).
 *     طالب ألف:  A1=18, A2=32, A3=10  -> S1 17.00, S2 10.00, overall 44/3 = 14.6667, rank 1
 *     طالب باء:  A1=12, A2=28, A3=16  -> S1 13.00, S2 16.00, overall 14.00, rank 2 (tie)
 *     طالب دال:  A1=14, A2=24, A3=16  -> S1 13.00, S2 16.00, overall 14.00, rank 2 (tie)
 *     طالب جيم:  A1=8,  A2=20, A3=12  -> S1 9.00,  S2 12.00, overall 10.00, rank 4
 *     طالب هاء:  no grades            -> average null, ranked last (0) -> rank 5
 *   Term T2 has an assessment + grade for طالب ألف but stays unpublished.
 */

const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:8080";
if (!BASE.includes("localhost") && !BASE.includes("127.0.0.1")) {
  console.error("Refusing to run against a non-local base URL:", BASE);
  process.exit(2);
}

const ADMIN_EMAIL = "admin@madjd.org";
const ADMIN_PASSWORD = process.env.ALMAJD_ADMIN_PASSWORD ?? "AlMajd@2026!";

const B1_NAME = "فرع إثبات التقارير";
const B2_NAME = "فرع إثبات آخر";
const CLASS_NAME = "فصل الإثبات أ";
const CLASS_EMPTY = "فصل الإثبات الفارغ";
const T1_NAME = "فصل الإثبات الأول";
const T2_NAME = "فصل الإثبات الثاني";
const S1 = { code: "PRF-MATH", nameAr: "رياضيات الإثبات" };
const S2 = { code: "PRF-SCI", nameAr: "علوم الإثبات" };
const HEAD1_EMAIL = "proof-head-1@madjd.local";
const HEAD2_EMAIL = "proof-head-2@madjd.local";
const HEAD_PASSWORD = "HeadProof@123";

let passed = 0;
let failed = 0;
function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log("  ok  " + name);
  } else {
    failed++;
    console.error("FAIL  " + name + (detail !== undefined ? " — " + JSON.stringify(detail) : ""));
  }
}
function near(a, b, eps = 1e-9) {
  return typeof a === "number" && Math.abs(a - b) <= eps;
}

function client() {
  let cookie = "";
  return {
    async req(method, path, body) {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of setCookies) {
        const [pair] = c.split(";");
        const [name, value] = pair.split("=");
        if (name.trim() === "almajd_session") cookie = pair.trim();
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* non-JSON */
      }
      return { status: res.status, data };
    },
    get(p) {
      return this.req("GET", p);
    },
    post(p, b) {
      return this.req("POST", p, b);
    },
  };
}

async function main() {
  const admin = client();
  const anon = client();

  // -- auth ----------------------------------------------------------------
  const login = await admin.post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert("admin login 200", login.status === 200, login.status);

  const unauth = await anon.get("/api/reports/students/whoever/report-card?termId=x");
  assert("unauthenticated report-card -> 401", unauth.status === 401, unauth.status);
  const unauth2 = await anon.get("/api/reports/classes/whoever/students");
  assert("unauthenticated class list -> 401", unauth2.status === 401, unauth2.status);
  const unauth3 = await anon.get("/api/reports/students/whoever/admission");
  assert("unauthenticated admission -> 401", unauth3.status === 401, unauth3.status);

  // -- fixture: branches ----------------------------------------------------
  const branchesRes = await admin.get("/api/branches");
  const branchList = branchesRes.data?.items ?? branchesRes.data?.branches ?? [];
  let b1 = branchList.find((b) => b.nameAr === B1_NAME);
  if (!b1) {
    const r = await admin.post("/api/branches", { nameAr: B1_NAME, nameFr: "Branche preuve" });
    assert("create fixture branch B1", r.status === 200, r.data);
    b1 = r.data?.branch;
  }
  let b2 = branchList.find((b) => b.nameAr === B2_NAME);
  if (!b2) {
    const r = await admin.post("/api/branches", { nameAr: B2_NAME });
    assert("create fixture branch B2", r.status === 200, r.data);
    b2 = r.data?.branch;
  }
  const B1 = b1.id;
  const B2 = b2.id;

  // -- fixture: head users ---------------------------------------------------
  const usersRes = await admin.get("/api/users");
  const userList = usersRes.data?.items ?? usersRes.data?.users ?? [];
  async function ensureUser(email, nameAr) {
    const found = userList.find((u) => u.email === email);
    if (found) return found;
    const r = await admin.post("/api/users", {
      role: "staff",
      nameAr,
      email,
      initialPassword: HEAD_PASSWORD,
      active: true,
    });
    assert("create head user " + email, r.status === 200, r.data);
    return r.data?.user;
  }
  const h1 = await ensureUser(HEAD1_EMAIL, "مدير فرع الإثبات");
  const h2 = await ensureUser(HEAD2_EMAIL, "مدير الفرع الآخر");
  await admin.post(`/api/branches/${B1}/branch-head`, { userId: h1.id });
  await admin.post(`/api/branches/${B2}/branch-head`, { userId: h2.id });

  const head1 = client();
  const h1login = await head1.post("/api/auth/login", { email: HEAD1_EMAIL, password: HEAD_PASSWORD });
  assert("head1 login (or password reset needed)", h1login.status === 200, h1login.status);
  const head2 = client();
  const h2login = await head2.post("/api/auth/login", { email: HEAD2_EMAIL, password: HEAD_PASSWORD });
  assert("head2 login", h2login.status === 200, h2login.status);

  // -- fixture: terms / subjects / year --------------------------------------
  const termsRes = await admin.get("/api/academic/terms");
  const termList = termsRes.data?.items ?? [];
  async function ensureTerm(nameAr, order) {
    const found = termList.find((t) => t.nameAr === nameAr);
    if (found) return found;
    const r = await admin.post("/api/academic/terms", { nameAr, order, active: true });
    assert("create term " + nameAr, r.status === 200, r.data);
    return r.data?.item;
  }
  const t1 = await ensureTerm(T1_NAME, 91);
  const t2 = await ensureTerm(T2_NAME, 92);

  const subsRes = await admin.get("/api/academic/subjects");
  const subList = subsRes.data?.items ?? [];
  async function ensureSubject(s) {
    const found = subList.find((x) => x.code === s.code);
    if (found) return found;
    const r = await admin.post("/api/academic/subjects", s);
    assert("create subject " + s.code, r.status === 200, r.data);
    return r.data?.item;
  }
  const s1 = await ensureSubject(S1);
  const s2 = await ensureSubject(S2);

  const yearsRes = await admin.get("/api/academic/years");
  const year = (yearsRes.data?.items ?? []).find((y) => y.isCurrent) ?? (yearsRes.data?.items ?? [])[0];
  assert("current academic year exists", Boolean(year), yearsRes.data);

  // -- fixture: classes --------------------------------------------------------
  const classesRes = await admin.get(`/api/academic/classes?branchId=${encodeURIComponent(B1)}`);
  const classList = classesRes.data?.items ?? [];
  async function ensureClass(nameAr) {
    const found = classList.find((c) => c.nameAr === nameAr && String(c.academicYearId ?? "") === String(year.id));
    if (found) return found;
    const r = await admin.post("/api/academic/classes", { branchId: B1, academicYearId: year.id, nameAr });
    assert("create class " + nameAr, r.status === 200, r.data);
    return r.data?.item;
  }
  const c1 = await ensureClass(CLASS_NAME);
  const cEmpty = await ensureClass(CLASS_EMPTY);
  const C1 = c1.id;

  // -- fixture: class subjects -------------------------------------------------
  const csRes = await admin.get(`/api/academic/classes/${C1}/class-subjects`);
  const csList = csRes.data?.items ?? [];
  async function ensureClassSubject(subjectId, coefficient, maxScore) {
    const found = csList.find((x) => String(x.subjectId) === String(subjectId));
    if (found) {
      assert("class-subject coefficient matches (" + subjectId + ")", found.coefficient === coefficient, found);
      return found;
    }
    const r = await admin.post(`/api/academic/classes/${C1}/class-subjects`, { subjectId, coefficient, maxScore });
    assert("attach class-subject " + subjectId, r.status === 200, r.data);
    return null;
  }
  await ensureClassSubject(s1.id, 2, 20);
  await ensureClassSubject(s2.id, 1, 20);

  // -- fixture: students -------------------------------------------------------
  const studentsRes = await admin.get(`/api/students?branchId=${encodeURIComponent(B1)}`);
  const studentList = studentsRes.data?.items ?? [];
  async function ensureStudent(nameAr, extra = {}) {
    const found = studentList.find((s) => s.nameAr === nameAr);
    if (found) return found;
    const r = await admin.post("/api/students", {
      nameAr,
      branchId: B1,
      klass: CLASS_NAME,
      gender: "male",
      enrolled: "2026-09-01",
      ...extra,
    });
    assert("register student " + nameAr, r.status === 200, r.data);
    return r.data?.student;
  }
  const stA = await ensureStudent("طالب ألف", { nameFr: "Eleve Alef", dob: "2012-03-04", placeOfBirth: "نجامينا", parentAr: "والد ألف", phone: "66000001" });
  const stB = await ensureStudent("طالب باء");
  const stD = await ensureStudent("طالب دال");
  const stC = await ensureStudent("طالب جيم");
  const stE = await ensureStudent("طالب هاء ذو الاسم الطويل جداً جداً للاختبار");
  // truly class-less: never registered with a klass, so no enrollment exists
  const stNoClass = await ensureStudent("طالب إثبات بلا فصل", { klass: "" });
  assert("no-class student has no enrollment", !stNoClass.classId, stNoClass.classId);

  // -- fixture: assessments ------------------------------------------------------
  const asRes = await admin.get(`/api/academic/assessments?classId=${C1}`);
  const asList = asRes.data?.items ?? [];
  async function ensureAssessment(subjectId, termId, title, maxScore) {
    const found = asList.find((a) => String(a.subjectId) === String(subjectId) && String(a.termId) === String(termId) && a.title === title);
    if (found) return found;
    const r = await admin.post("/api/academic/assessments", {
      classId: C1,
      subjectId,
      termId,
      typeCode: "quiz",
      title,
      date: "2026-10-15",
      maxScore,
    });
    assert("create assessment " + title, r.status === 200, r.data);
    return r.data?.item;
  }
  const a1 = await ensureAssessment(s1.id, t1.id, "فرض الإثبات ١", 20);
  const a2 = await ensureAssessment(s1.id, t1.id, "فرض الإثبات ٢", 40);
  const a3 = await ensureAssessment(s2.id, t1.id, "فرض إثبات العلوم", 20);
  const a4 = await ensureAssessment(s1.id, t2.id, "فرض الإثبات فصل ثانٍ", 20);

  // -- fixture: grades ------------------------------------------------------------
  async function grade(studentId, assessmentId, score) {
    const r = await admin.post("/api/academic/grades", { studentId, assessmentId, score });
    assert(`grade ${score} (${assessmentId.slice(0, 6)}…)`, r.status === 200, r.data);
  }
  await grade(stA.id, a1.id, 18);
  await grade(stA.id, a2.id, 32);
  await grade(stA.id, a3.id, 10);
  await grade(stB.id, a1.id, 12);
  await grade(stB.id, a2.id, 28);
  await grade(stB.id, a3.id, 16);
  await grade(stD.id, a1.id, 14);
  await grade(stD.id, a2.id, 24);
  await grade(stD.id, a3.id, 16);
  await grade(stC.id, a1.id, 8);
  await grade(stC.id, a2.id, 20);
  await grade(stC.id, a3.id, 12);
  await grade(stA.id, a4.id, 20); // term T2, stays unpublished

  // ==========================================================================
  // Phase A — unpublished term exposes structure only
  // ==========================================================================
  await admin.post(`/api/academic/classes/${C1}/results`, { termId: t1.id, published: false });
  const preCard = (await admin.get(`/api/reports/students/${stA.id}/report-card?termId=${t1.id}`)).data?.report;
  assert("unpublished: published flag false", preCard && preCard.published === false, preCard?.published);
  assert("unpublished: subjects structure present", preCard && preCard.subjects.length === 2, preCard?.subjects?.length);
  assert(
    "unpublished: all scores null",
    preCard && preCard.subjects.every((s) => s.assessments.every((a) => a.score === null && a.percent === null)),
  );
  assert("unpublished: averages null", preCard && preCard.subjects.every((s) => s.average20 === null));
  assert("unpublished: overall null", preCard && preCard.average20 === null && preCard.percentage === null);
  assert("unpublished: rank null", preCard && preCard.rank === null, preCard?.rank);

  // ==========================================================================
  // Phase B — published term: exact mathematics
  // ==========================================================================
  await admin.post(`/api/academic/classes/${C1}/results`, { termId: t1.id, published: true });

  async function card(studentId, termId) {
    const r = await admin.get(`/api/reports/students/${studentId}/report-card?termId=${termId}`);
    assert("report-card 200", r.status === 200, r.status);
    return r.data?.report;
  }
  const cardA = await card(stA.id, t1.id);
  const cardB = await card(stB.id, t1.id);
  const cardD = await card(stD.id, t1.id);
  const cardC = await card(stC.id, t1.id);
  const cardE = await card(stE.id, t1.id);

  function subjectOf(cardRes, subjectId) {
    return cardRes.subjects.find((s) => String(s.subjectId) === String(subjectId));
  }

  // per-assessment percentages (incl. max-score normalization 32/40 = 80%)
  const aS1 = subjectOf(cardA, s1.id);
  assert("A/S1 has 2 assessments", aS1.assessments.length === 2, aS1.assessments.length);
  const a1Pct = aS1.assessments.find((a) => a.title === "فرض الإثبات ١")?.percent;
  const a2Pct = aS1.assessments.find((a) => a.title === "فرض الإثبات ٢")?.percent;
  assert("A assessment percent 18/20 = 90", near(a1Pct, 90), a1Pct);
  assert("A assessment percent 32/40 = 80 (normalized)", near(a2Pct, 80), a2Pct);
  assert("A/S1 average = 17.00/20", near(aS1.average20, 17), aS1.average20);
  assert("A/S1 weighted = 34 (coef 2)", near(aS1.weightedPoints, 34), aS1.weightedPoints);
  const aS2 = subjectOf(cardA, s2.id);
  assert("A/S2 average = 10.00/20", near(aS2.average20, 10), aS2.average20);
  assert("A/S2 weighted = 10 (coef 1)", near(aS2.weightedPoints, 10), aS2.weightedPoints);

  // overall: (17*2 + 10*1) / 3 = 14.666…
  assert("A overall = 44/3 ≈ 14.6667", near(cardA.average20, 44 / 3), cardA.average20);
  assert("A percentage = 73.333…", near(cardA.percentage, (44 / 3 / 20) * 100), cardA.percentage);
  assert("A totalCoefficient = 3", cardA.totalCoefficient === 3, cardA.totalCoefficient);
  assert("A appreciation جيد جدا", cardA.appreciation === "جيد جدا", cardA.appreciation);
  assert("A rank = 1", cardA.rank === 1, cardA.rank);
  assert("classSize = 5", cardA.classSize === 5, cardA.classSize);

  // tie: B and D both 14.00 -> both rank 2
  assert("B overall = 14.00", near(cardB.average20, 14), cardB.average20);
  assert("D overall = 14.00", near(cardD.average20, 14), cardD.average20);
  assert("B rank = 2 (tie)", cardB.rank === 2, cardB.rank);
  assert("D rank = 2 (tie)", cardD.rank === 2, cardD.rank);
  // C: 10.00 -> rank 4 (ties consume rank 3)
  assert("C overall = 10.00", near(cardC.average20, 10), cardC.average20);
  assert("C appreciation مقبول", cardC.appreciation === "مقبول", cardC.appreciation);
  assert("C rank = 4", cardC.rank === 4, cardC.rank);
  // E: no grades -> clean empty state but still ranked last (average 0)
  assert("E average null (no fake zeros)", cardE.average20 === null, cardE.average20);
  assert("E all subject averages null", cardE.subjects.every((s) => s.average20 === null));
  assert("E all scores null", cardE.subjects.every((s) => s.assessments.every((a) => a.score === null)));
  assert("E appreciation null", cardE.appreciation === null, cardE.appreciation);
  assert("E ranked last (5)", cardE.rank === 5, cardE.rank);

  // every subject exactly once
  assert(
    "each subject appears exactly once",
    cardA.subjects.length === 2 && new Set(cardA.subjects.map((s) => s.subjectId)).size === 2,
  );

  // term isolation: T1 report contains no T2 assessment
  const titlesT1 = cardA.subjects.flatMap((s) => s.assessments.map((a) => a.title));
  assert("term isolation: T2 assessment absent from T1 card", !titlesT1.includes("فرض الإثبات فصل ثانٍ"), titlesT1);

  // T2 unpublished despite existing grade
  const cardA2 = await card(stA.id, t2.id);
  assert("T2 unpublished: scores null", cardA2.subjects.every((s) => s.assessments.every((a) => a.score === null)));
  assert("T2 unpublished: average null", cardA2.average20 === null, cardA2.average20);
  assert("T2 has the T2 assessment structure", titlesT2Has(cardA2, "فرض الإثبات فصل ثانٍ"), cardA2.subjects.map((s) => s.assessments.length));
  function titlesT2Has(c, title) {
    return c.subjects.some((s) => s.assessments.some((a) => a.title === title));
  }

  // student with no class enrollment: clean empty state
  const cardNC = await card(stNoClass.id, t1.id);
  assert("no-class student: 200 with empty structure", cardNC.subjects.length === 0 && cardNC.average20 === null);
  assert("no-class student: published false, rank null", cardNC.published === false && cardNC.rank === null);

  // ==========================================================================
  // Phase C — class student list
  // ==========================================================================
  const roster = (await admin.get(`/api/reports/classes/${C1}/students`)).data?.roster;
  assert("roster: 5 students", roster && roster.students.length === 5, roster?.students?.length);
  const rosterIds = roster?.students.map((s) => s.id) ?? [];
  assert("roster: no duplicates", new Set(rosterIds).size === rosterIds.length);
  assert(
    "roster: membership exact",
    [stA, stB, stC, stD, stE].every((s) => rosterIds.includes(s.id)) && !rosterIds.includes(stNoClass.id),
    rosterIds,
  );
  assert("roster: ordered by Arabic name", isOrderedByName(roster.students.map((s) => s.nameAr)), roster.students.map((s) => s.nameAr));
  function isOrderedByName(names) {
    const sorted = [...names].sort((x, y) => x.localeCompare(y, "ar"));
    // accept DB collation order; only verify monotonic non-decreasing per ICU 'ar' OR raw codepoint
    const raw = [...names].sort();
    return names.every((n, i) => n === sorted[i]) || names.every((n, i) => n === raw[i]);
  }
  assert("roster: branch/class/year populated", roster.branch.id === B1 && roster.class.id === C1 && Boolean(roster.academicYear.label));
  assert("roster: gender + enrolled present", roster.students.every((s) => typeof s.gender === "string" && typeof s.enrolled === "string"));

  const emptyRoster = (await admin.get(`/api/reports/classes/${cEmpty.id}/students`)).data?.roster;
  assert("empty class roster: 0 students, 200", emptyRoster && emptyRoster.students.length === 0);

  // ==========================================================================
  // Phase D — admission document
  // ==========================================================================
  const admRes = await admin.get(`/api/reports/students/${stA.id}/admission`);
  const adm = admRes.data?.document;
  assert("admission 200", admRes.status === 200, admRes.status);
  assert("admission reference format ADM-YYYY-NNNN", /^ADM-\d{4}-\d{4}$/.test(adm?.reference ?? ""), adm?.reference);
  assert("admission identity", adm.student.nameAr === "طالب ألف" && adm.student.nameFr === "Eleve Alef");
  assert("admission demographics", adm.student.dob === "2012-03-04" && adm.student.placeOfBirth === "نجامينا" && adm.student.parentAr === "والد ألف");
  assert("admission branch/class", adm.branch.id === B1 && adm.className === CLASS_NAME, adm.className);
  assert("admission enrolled date", adm.student.enrolled === "2026-09-01", adm.student.enrolled);
  const admRaw = JSON.stringify(adm);
  assert("admission leaks no password/hash", !/password|hash/i.test(admRaw), admRaw.slice(0, 200));

  // ==========================================================================
  // Phase E — authorization
  // ==========================================================================
  // own-branch head: 200 on all three reports
  const h1card = await head1.get(`/api/reports/students/${stA.id}/report-card?termId=${t1.id}`);
  assert("own-branch head report-card -> 200", h1card.status === 200, h1card.status);
  const h1roster = await head1.get(`/api/reports/classes/${C1}/students`);
  assert("own-branch head class list -> 200", h1roster.status === 200, h1roster.status);
  const h1adm = await head1.get(`/api/reports/students/${stA.id}/admission`);
  assert("own-branch head admission -> 200", h1adm.status === 200, h1adm.status);
  assert("head sees same overall as admin", near(h1card.data?.report?.average20, 44 / 3), h1card.data?.report?.average20);

  // cross-branch head: 403 on all three
  const h2card = await head2.get(`/api/reports/students/${stA.id}/report-card?termId=${t1.id}`);
  assert("cross-branch head report-card -> 403", h2card.status === 403, h2card.status);
  const h2roster = await head2.get(`/api/reports/classes/${C1}/students`);
  assert("cross-branch head class list -> 403", h2roster.status === 403, h2roster.status);
  const h2adm = await head2.get(`/api/reports/students/${stA.id}/admission`);
  assert("cross-branch head admission -> 403", h2adm.status === 403, h2adm.status);

  // malformed / missing resources
  const badTerm = await admin.get(`/api/reports/students/${stA.id}/report-card?termId=does-not-exist`);
  assert("unknown term -> 404", badTerm.status === 404, badTerm.status);
  const noTerm = await admin.get(`/api/reports/students/${stA.id}/report-card`);
  assert("missing termId -> 400", noTerm.status === 400, noTerm.status);
  const badStudent = await admin.get("/api/reports/students/no-such-student/report-card?termId=" + t1.id);
  assert("unknown student -> 404", badStudent.status === 404, badStudent.status);
  const badClass = await admin.get("/api/reports/classes/no-such-class/students");
  assert("unknown class -> 404", badClass.status === 404, badClass.status);

  // head cannot create staff accounts nor disable logins
  const staffTry = await head1.post("/api/users", { role: "staff", nameAr: "موظف متسلل", email: "sneaky@madjd.local", initialPassword: "Sneaky@123" });
  assert("head cannot create staff account -> 403", staffTry.status === 403, staffTry.status);
  const disableTry = await head1.post("/api/users", { disableLogin: true, studentId: stA.id });
  assert("head cannot disable login -> 403", disableTry.status === 403, disableTry.status);

  // head CAN create a bound student login in his own branch
  const loginTry = await head1.post("/api/users", {
    role: "student",
    studentId: stB.id,
    nameAr: stB.nameAr,
    active: true,
    initialPassword: "StuProof@123",
  });
  assert("own-branch head creates student login -> 200", loginTry.status === 200, loginTry.status);
  const loginInfo = loginTry.data?.login;
  assert(
    "student login returns credentials once (create or reset)",
    Boolean(loginInfo?.email) && loginInfo?.password === "StuProof@123",
    loginTry.data,
  );
  const admB = (await admin.get(`/api/reports/students/${stB.id}/admission`)).data?.document;
  assert("admission shows login username after binding", admB.loginUsername === loginInfo?.email, admB.loginUsername);

  // head CANNOT create a login for a student of another branch
  const stB2 = await (async () => {
    const r = await admin.post("/api/students", { nameAr: "طالب الفرع الآخر", branchId: B2, klass: "" });
    assert("register student in B2", r.status === 200, r.data);
    return r.data?.student;
  })();
  const crossLogin = await head1.post("/api/users", { role: "student", studentId: stB2.id, nameAr: stB2.nameAr, active: true });
  assert("cross-branch student login creation -> 403", crossLogin.status === 403, crossLogin.status);
  const ownLogin2 = await head2.post("/api/users", { role: "student", studentId: stB2.id, nameAr: stB2.nameAr, active: true });
  assert("own-branch (B2) head creates student login -> 200", ownLogin2.status === 200, ownLogin2.status);

  // inactive head loses access immediately
  await admin.req("DELETE", `/api/branches/${B2}/branch-head`);
  const inactiveProbe = await head2.get(`/api/reports/students/${stB2.id}/admission`);
  assert("inactive head -> 403", inactiveProbe.status === 403, inactiveProbe.status);
  await admin.post(`/api/branches/${B2}/branch-head`, { userId: h2.id });
  const restoredProbe = await head2.get(`/api/reports/students/${stB2.id}/admission`);
  assert("re-assigned head -> 200", restoredProbe.status === 200, restoredProbe.status);

  // student login (portal role) cannot read other students' reports
  const stuClient = client();
  const stuLogin = await stuClient.post("/api/auth/login", { email: loginInfo.email, password: loginInfo.password });
  assert("student portal login 200", stuLogin.status === 200, stuLogin.status);
  const stuOwn = await stuClient.get(`/api/reports/students/${stB.id}/report-card?termId=${t1.id}`);
  assert("student own report-card -> 200", stuOwn.status === 200, stuOwn.status);
  const stuOther = await stuClient.get(`/api/reports/students/${stA.id}/report-card?termId=${t1.id}`);
  assert("student reading another student's card -> 403", stuOther.status === 403, stuOther.status);
  const stuRoster = await stuClient.get(`/api/reports/classes/${C1}/students`);
  assert("student reading class roster -> 403", stuRoster.status === 403, stuRoster.status);
  const stuOwnAdm = await stuClient.get(`/api/reports/students/${stB.id}/admission`);
  assert("student own admission -> 200", stuOwnAdm.status === 200, stuOwnAdm.status);
  const stuOtherAdm = await stuClient.get(`/api/reports/students/${stA.id}/admission`);
  assert("student reading another student's admission -> 403", stuOtherAdm.status === 403, stuOtherAdm.status);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
