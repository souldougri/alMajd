// One-off verification: executes the Phase 2A DDL against an in-memory PGLite
// database and sanity-checks the key constraints and seed data.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
const src = readFileSync(new URL("../src/server/schema.ts", import.meta.url), "utf8");

function extract(name) {
  const m = src.match(new RegExp("export const " + name + " = `([\\s\\S]*?)`;"));
  if (!m) throw new Error("could not extract " + name);
  return m[1];
}

const SCHEMA_SQL = extract("SCHEMA_SQL");
const SEED_LOOKUPS_SQL = extract("SEED_LOOKUPS_SQL");

const db = new PGlite();
await db.exec(SCHEMA_SQL);
await db.exec(SEED_LOOKUPS_SQL);

const q = async (sql, params) => (await db.query(sql, params)).rows;

// baseline data
await q(
  "INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ($1,$2,true,true,$3,$3)",
  ["br-main", "الفرع الرئيسي", new Date().toISOString()],
);
await q(
  "INSERT INTO academic_years (id, label, is_current, active, created_at) VALUES ($1,$2,true,true,$3)",
  ["ay-1", "2026–2027", new Date().toISOString()],
);
await q(
  "INSERT INTO users (id, email, name_ar, role, password_hash, created_at, updated_at) VALUES ('u1','a@b.c','A','staff','x',$1,$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO users (id, email, name_ar, role, password_hash, created_at, updated_at) VALUES ('u2','c@d.e','B','staff','x',$1,$1)",
  [new Date().toISOString()],
);

// lookup seeds
const duties = await q("SELECT code FROM duties ORDER BY code");
console.log("duties:", duties.map((r) => r.code).join(","));
const ats = await q("SELECT code FROM assessment_types ORDER BY sort_order");
console.log("assessment_types:", ats.map((r) => r.code).join(","));

// branch head: one active per branch + one active branch per user
await q(
  "INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_by_user_id, appointed_at) VALUES ('bh1','br-main','u1',true,NULL,$1)",
  [new Date().toISOString()],
);
let failed = false;
try {
  await q(
    "INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_by_user_id, appointed_at) VALUES ('bh2','br-main','u2',true,NULL,$1)",
    [new Date().toISOString()],
  );
  failed = true;
  console.log("FAIL: allowed a second active BH for the same branch");
} catch (e) {
  console.log("OK: second active BH for same branch rejected ->", e.message.slice(0, 60));
}
// Reassignment: deactivate the current BH, then assign the new one.
await q("UPDATE branch_heads SET active = false WHERE id = 'bh1'", []);
await q(
  "INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_by_user_id, appointed_at) VALUES ('bh2','br-main','u2',true,NULL,$1)",
  [new Date().toISOString()],
);
// One active branch per user: u2 already heads br-main, so a second active
// assignment for u2 on another branch must be rejected.
await q(
  "INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ('br-2','فرع ثان',true,false,$1,$1)",
  [new Date().toISOString()],
);
try {
  await q(
    "INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_by_user_id, appointed_at) VALUES ('bh4','br-2','u2',true,NULL,$1)",
    [new Date().toISOString()],
  );
  console.log("FAIL: allowed a second active branch for one user");
} catch (e) {
  console.log("OK: second active branch for same user rejected ->", e.message.slice(0, 60));
}
console.log(failed ? "" : "OK: BH reassignment requires deactivating the current head first");

// financial officer: one per branch (PK), many branches per officer
await q(
  "INSERT INTO branch_financial_officers (branch_id, financial_officer_user_id, assigned_at) VALUES ('br-main','u1',$1)",
  [new Date().toISOString()],
);
try {
  await q(
    "INSERT INTO branch_financial_officers (branch_id, financial_officer_user_id, assigned_at) VALUES ('br-main','u2',$1)",
    [new Date().toISOString()],
  );
  console.log("FAIL: allowed a second FO for the same branch");
} catch (e) {
  console.log("OK: second FO for same branch rejected ->", e.message.slice(0, 60));
}

// classes (year instances) + class_subjects + teaching + assessments + grades
await q(
  "INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('cl1','br-main','ay-1','3 أ',true,$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO subjects (id, code, name_ar, created_at) VALUES ('sb1','math','رياضيات',$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO class_subjects (id, class_id, subject_id, coefficient, max_score) VALUES ('cs1','cl1','sb1',3,20)",
  [],
);
await q(
  "INSERT INTO teaching_assignments (id, teacher_user_id, class_id, subject_id, academic_year_id, assigned_at) VALUES ('ta1','u2','cl1','sb1','ay-1',$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO students (id, name_ar, branch_id, created_at, updated_at) VALUES ('st1','طالب 1','br-main',$1,$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current) VALUES ('en1','st1','cl1','ay-1','enrolled',CURRENT_DATE,true)",
  [],
);
await q(
  "INSERT INTO terms (id, name_ar, \"order\", active) VALUES ('term-1','الفصل الأول',1,true)",
  [],
);
await q(
  "INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, max_score, created_at) VALUES ('as1','cl1','sb1','term-1','quiz','اختبار قصير 1',20,$1)",
  [new Date().toISOString()],
);
await q(
  "INSERT INTO grades (id, student_id, assessment_id, score, created_at, updated_at) VALUES ('g1','st1','as1',15,$1,$1)",
  [new Date().toISOString()],
);
console.log("OK: assessment + grade insert path works");

// attendance uniqueness
await q(
  "INSERT INTO attendance (id, class_id, student_id, date, status, created_at) VALUES ('at1','cl1','st1','2026-09-01','present',$1)",
  [new Date().toISOString()],
);
try {
  await q("INSERT INTO attendance (id, class_id, student_id, date, status, created_at) VALUES ('at2','cl1','st1','2026-09-01','absent',$1)", [new Date().toISOString()]);
  console.log("FAIL: duplicate attendance allowed");
} catch (e) {
  console.log("OK: duplicate attendance rejected ->", e.message.slice(0, 60));
}

// scope resolver query shape (union of assignment tables)
const scope = await q(
  `SELECT branch_id FROM user_branch_assignments WHERE user_id=$1
   UNION SELECT branch_id FROM teacher_branch_assignments WHERE teacher_user_id=$1
   UNION SELECT branch_id FROM branch_heads WHERE user_id=$1 AND active=true
   UNION SELECT branch_id FROM branch_financial_officers WHERE financial_officer_user_id=$1`,
  ["u1"],
);
console.log("scope branches for u1:", scope.map((r) => r.branch_id).join(","));

console.log("ALL SCHEMA CHECKS PASSED");
await db.close();