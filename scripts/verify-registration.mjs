/**
 * Live end-to-end verification of unified student registration.
 *
 * Requires the dev server running locally (npm run dev, port 8080) with the
 * local PGlite database. NEVER run this against a production/Neon URL.
 *
 * Proves, against the real HTTP API:
 *  - super_admin POST /api/students returns student + BOTH one-time logins
 *    (student email/password and parent email/password, all non-empty)
 *  - a Branch Head registers in his own branch with the same shape
 *  - cross-branch registration by that head is rejected (403), and the
 *    branch-filtered students list is also rejected cross-branch (403)
 *  - idempotency: replaying the same body with the same client id returns
 *    the same student, no error, and the list shows exactly one such row
 *  - neither the students list nor the single-student GET leaks any
 *    password/hash material
 *
 * The partial-heal branch (replay repairing a missing login) is
 * server-internal and needs DB manipulation to simulate — out of scope here.
 *
 * Fixture (deterministic, independent from verify-reports):
 *   Branch RA "فرع إثبات التسجيل أ", Branch RB "فرع إثبات التسجيل ب",
 *   head user reg-head-1@madjd.local assigned to RA.
 *   A fresh idempotency key per run keeps assertions valid on re-runs.
 */

const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:8080";
if (!BASE.includes("localhost") && !BASE.includes("127.0.0.1")) {
  console.error("Refusing to run against a non-local base URL:", BASE);
  process.exit(2);
}

const ADMIN_EMAIL = "admin@madjd.org";
const ADMIN_PASSWORD = process.env.ALMAJD_ADMIN_PASSWORD ?? "AlMajd@2026!";

const RA_NAME = "فرع إثبات التسجيل أ";
const RB_NAME = "فرع إثبات التسجيل ب";
const HEAD_EMAIL = "reg-head-1@madjd.local";
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
        const [name] = pair.split("=");
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

function assertCredentialsShape(tag, login) {
  assert(tag + ": student email present", Boolean(login?.student?.email), login?.student);
  assert(tag + ": student password non-empty", typeof login?.student?.password === "string" && login.student.password.length > 0, login?.student);
  assert(tag + ": parent email present", Boolean(login?.parent?.email), login?.parent);
  assert(tag + ": parent password non-empty", typeof login?.parent?.password === "string" && login.parent.password.length > 0, login?.parent);
  assert(tag + ": student and parent emails differ", login?.student?.email !== login?.parent?.email, { s: login?.student?.email, p: login?.parent?.email });
}

async function main() {
  const admin = client();

  // -- auth ------------------------------------------------------------------
  const login = await admin.post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert("admin login 200", login.status === 200, login.status);

  // -- fixture: branches + head ----------------------------------------------
  const branchesRes = await admin.get("/api/branches");
  const branchList = branchesRes.data?.items ?? branchesRes.data?.branches ?? [];
  let ra = branchList.find((b) => b.nameAr === RA_NAME);
  if (!ra) {
    const r = await admin.post("/api/branches", { nameAr: RA_NAME });
    assert("create fixture branch RA", r.status === 200, r.data);
    ra = r.data?.branch;
  }
  let rb = branchList.find((b) => b.nameAr === RB_NAME);
  if (!rb) {
    const r = await admin.post("/api/branches", { nameAr: RB_NAME });
    assert("create fixture branch RB", r.status === 200, r.data);
    rb = r.data?.branch;
  }
  const RA = ra.id;
  const RB = rb.id;

  const usersRes = await admin.get("/api/users");
  const userList = usersRes.data?.items ?? usersRes.data?.users ?? [];
  let head = userList.find((u) => u.email === HEAD_EMAIL);
  if (!head) {
    const r = await admin.post("/api/users", {
      role: "staff",
      nameAr: "مدير فرع إثبات التسجيل",
      email: HEAD_EMAIL,
      initialPassword: HEAD_PASSWORD,
      active: true,
    });
    assert("create head user", r.status === 200, r.data);
    head = r.data?.user;
  }
  await admin.post(`/api/branches/${RA}/branch-head`, { userId: head.id });

  const headClient = client();
  const headLogin = await headClient.post("/api/auth/login", { email: HEAD_EMAIL, password: HEAD_PASSWORD });
  assert("head login 200", headLogin.status === 200, headLogin.status);

  // ==========================================================================
  // Phase A — admin registration returns both credential pairs
  // ==========================================================================
  const idemKey = crypto.randomUUID();
  const body = {
    id: idemKey,
    nameAr: "طالب إثبات التسجيل",
    nameFr: "Eleve Inscription",
    gender: "female",
    klass: "فصل الإثبات",
    dob: "2013-05-06",
    parentAr: "والد طالب الإثبات",
    phone: "66000099",
    branchId: RA,
  };
  const created = await admin.post("/api/students", body);
  assert("admin registration -> 200", created.status === 200, created.data);
  assert("registration returns student with id", Boolean(created.data?.student?.id), created.data?.student);
  assert("student id matches idempotency key", created.data?.student?.id === idemKey, created.data?.student?.id);
  assertCredentialsShape("admin registration", created.data?.login);

  // ==========================================================================
  // Phase B — idempotency: replay same body, same id
  // ==========================================================================
  const replay = await admin.post("/api/students", body);
  assert("replay -> 200 (no error)", replay.status === 200, replay.data);
  assert("replay returns the same student id (no duplicate)", replay.data?.student?.id === created.data?.student?.id, {
    first: created.data?.student?.id,
    replay: replay.data?.student?.id,
  });
  const listAfter = await admin.get(`/api/students?branchId=${encodeURIComponent(RA)}`);
  assert("students list -> 200", listAfter.status === 200, listAfter.status);
  const rowsWithId = (listAfter.data?.items ?? []).filter((s) => s.id === idemKey);
  assert("list shows exactly one row with the idempotency key", rowsWithId.length === 1, rowsWithId.length);

  // ==========================================================================
  // Phase C — Branch Head registration in own branch
  // ==========================================================================
  const headCreated = await headClient.post("/api/students", {
    nameAr: "طالب إثبات مدير الفرع",
    gender: "male",
    klass: "فصل الإثبات",
    branchId: RA,
  });
  assert("own-branch head registration -> 200", headCreated.status === 200, headCreated.data);
  assertCredentialsShape("head registration", headCreated.data?.login);

  // ==========================================================================
  // Phase D — cross-branch write + read blocked
  // ==========================================================================
  const crossWrite = await headClient.post("/api/students", {
    nameAr: "طالب متسلل",
    branchId: RB,
  });
  assert("cross-branch head registration -> 403", crossWrite.status === 403, crossWrite.status);
  const crossRead = await headClient.get(`/api/students?branchId=${encodeURIComponent(RB)}`);
  assert("cross-branch branch-filtered students list -> 403", crossRead.status === 403, crossRead.status);
  const crossSingle = await headClient.get(`/api/students/${idemKey}`);
  assert("own-branch single-student GET -> 200", crossSingle.status === 200, crossSingle.status);

  // ==========================================================================
  // Phase E — password non-leakage on reads
  // ==========================================================================
  const listRaw = JSON.stringify(listAfter.data);
  assert("students list leaks no password/hash", !/password|hash/i.test(listRaw), listRaw.slice(0, 200));
  const singleRaw = JSON.stringify(crossSingle.data);
  assert("single-student GET leaks no password/hash", !/password|hash/i.test(singleRaw), singleRaw.slice(0, 200));

  // replay passwords may be empty (heal path is a no-op when logins exist)
  assert(
    "replay login shape present (passwords may be empty on replay)",
    Boolean(replay.data?.login?.student) && Boolean(replay.data?.login?.parent),
    replay.data?.login,
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
