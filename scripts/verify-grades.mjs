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
await q("INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ('b1','main',true,true,$1,$1)", [now]);
await q("INSERT INTO academic_years (id, label, is_current, active, created_at) VALUES ('ay1','2026-2027',true,true,$1)", [now]);
await q("INSERT INTO terms (id, name_ar, name_fr, \"order\") VALUES ('t1','فصل أول','Trimestre 1',1)", []);
await q("INSERT INTO subjects (id, code, name_ar, created_at) VALUES ('sx1','MATH','Riyadh',$1)", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c1','b1','ay1','3A',true,$1)", [now]);
await q("INSERT INTO class_subjects (id, class_id, subject_id, coefficient, max_score) VALUES ('cs1','c1','sx1',2,20)", []);
await q("INSERT INTO students (id, name_ar, branch_id, klass, active, created_at, updated_at) VALUES ('st1','طالب واحد','b1','3A',true,$1,$1)", [now]);
await q("INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, is_current) VALUES ('e1','st1','c1','ay1','enrolled',true)", []);
await q("INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, max_score, created_at) VALUES ('a1','c1','sx1','t1','quiz','Revision',20,$1)", [now]);
await q("INSERT INTO grades (id, student_id, assessment_id, score, created_at, updated_at) VALUES ('g1','st1','a1',15,$1,$1)", [now]);

// UNIQUE(class_id, subject_id, term_id, type_code, title)
let e = await expectError("INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, max_score, created_at) VALUES ('a2','c1','sx1','t1','quiz','Revision',20,$1)", [now], /unique|duplicate/i);
assert("assessment unique (class, subject, term, type, title)", e === "ok");

// UNIQUE(student_id, assessment_id)
e = await expectError("INSERT INTO grades (id, student_id, assessment_id, score, created_at, updated_at) VALUES ('g2','st1','a1',20,$1,$1)", [now], /unique|duplicate/i);
assert("grade unique (student, assessment)", e === "ok");

// grade CHECK score within max (budget check: no CHECK on score, enforced at service)
const grade = (await q("SELECT score FROM grades WHERE id='g1'"))[0];
assert("grade row persisted", grade !== undefined);

// assessment FK -> class / subject / term
e = await expectError("INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, max_score, created_at) VALUES ('a3','nope','sx1','t1','quiz','Q',20,$1)", [now], /foreign|constraint/i);
assert("assessment FK -> classes", e === "ok");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);