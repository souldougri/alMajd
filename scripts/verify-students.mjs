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

const db = new PGlite();
await db.exec(extract("SCHEMA_SQL"));
await db.exec(extract("SEED_LOOKUPS_SQL"));

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log("  ok  " + name); }
  else { failed++; console.error("FAIL  " + name); }
}
async function expectError(sql, params, rx) {
  try { await q(sql, params); return null; } catch (e) { return rx.test(e.message) ? "ok" : "other:" + e.message; }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const now = new Date().toISOString();

// fixtures
await q("INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ($1,$2,true,true,$3,$3)", ["b1", "main", now]);
await q("INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ($1,$2,true,false,$3,$3)", ["b2", "second", now]);
await q("INSERT INTO academic_years (id, label, is_current, active, created_at) VALUES ('ay1','2026-2027',true,true,$1)", [now]);
await q("INSERT INTO academic_years (id, label, is_current, active, created_at) VALUES ('ay2','2027-2028',false,true,$1)", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, created_at) VALUES ('c1','b1','ay1','3A',$1)", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, created_at) VALUES ('c2','b2','ay1','3B',$1)", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, created_at) VALUES ('c3','b1','ay2','4A',$1)", [now]);
await q("INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, duties, created_at, updated_at) VALUES ('u1','u1@t','U','','staff','x',true,'', $1,$1)", [now]);

// register: student + initial current history row
await q(`INSERT INTO students (id, name_ar, branch_id, active, created_at, updated_at) VALUES ('s1','Ali','b1',true,$1,$1)`, [now]);
await q(`INSERT INTO student_branch_history (id, student_id, branch_id, effective_date, reason, is_current, moved_by_user_id) VALUES ('h1','s1','b1',$1,'registration',true,'u1')`, [now]);
let row = (await q("SELECT COUNT(*) c FROM student_branch_history WHERE student_id='s1' AND is_current=true"))[0];
assert("registration creates one current history row", Number(row.c) === 1);

// register with enrollment
await q(`INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id) VALUES ('e1','s1','c1','ay1','enrolled',$1,true,'u1')`, [now]);

// duplicate enrollment rejected (unique student,class,year)
let e = await expectError(`INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id) VALUES ('e2','s1','c1','ay1','enrolled',$1,true,'u1')`, [now], /unique|duplicate/i);
assert("enrollment unique (student,class,year)", e === "ok");

// enrollment status CHECK
e = await expectError(`INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id) VALUES ('e3','s1','c2','ay1','bogus',$1,true,'u1')`, [now], /check|constraint/i);
assert("enrollment status CHECK enforced", e === "ok");

// transfer: switch branch, close enrollment, new current history row
await q("UPDATE student_class_enrollments SET status='transferred', is_current=false, left_on=$1 WHERE student_id='s1' AND is_current=true AND status='enrolled'", [now]);
await q("UPDATE students SET branch_id='b2', updated_at=$1 WHERE id='s1'", [now]);
await q("UPDATE student_branch_history SET is_current=false WHERE student_id='s1' AND is_current=true", []);
await q(`INSERT INTO student_branch_history (id, student_id, branch_id, effective_date, reason, is_current, moved_by_user_id) VALUES ('h2','s1','b2',$1,'transfer',true,'u1')`, [now]);
row = (await q("SELECT branch_id FROM students WHERE id='s1'"))[0];
assert("transfer updates current branch to b2", row.branch_id === "b2");
const cur = await q("SELECT branch_id, is_current FROM student_branch_history WHERE student_id='s1' AND is_current=true");
assert("transfer marks exactly one history row current (b2)", cur.length === 1 && cur[0].branch_id === "b2");
const closed = await q("SELECT status, is_current FROM student_class_enrollments WHERE student_id='s1' AND class_id='c1'");
assert("previous enrollment closed as transferred", closed[0].status === "transferred" && closed[0].is_current === false);

// re-enroll in target branch class
await q(`INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id) VALUES ('e4','s1','c2','ay1','enrolled',$1,true,'u1')`, [now]);
assert("re-enrolled in target branch", true);

// promote: close current, enroll next year, update klass
await q("UPDATE student_class_enrollments SET status='promoted', is_current=false, left_on=$1 WHERE student_id='s1' AND is_current=true AND status IN ('enrolled','promoted')", [now]);
await q(`INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, enrolled_on, is_current, recorded_by_user_id) VALUES ('e5','s1','c3','ay2','enrolled',$1,true,'u1')`, [now]);
await q("UPDATE students SET klass='4A', updated_at=$1 WHERE id='s1'", [now]);
row = (await q("SELECT klass FROM students WHERE id='s1'"))[0];
const promoted = await q("SELECT status FROM student_class_enrollments WHERE student_id='s1' ORDER BY enrolled_on ASC");
assert("promotion updates klass", row.klass === "4A");
assert("promotion closes prior enrollment", promoted.map(r => r.status).includes("promoted") && promoted.map(r => r.status).includes("enrolled"));

// history order preserved
const hist = await q("SELECT branch_id FROM student_branch_history WHERE student_id='s1' ORDER BY effective_date ASC, id ASC");
assert("history rows ordered (b1 then b2)", hist[0].branch_id === "b1" && hist[1].branch_id === "b2");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);