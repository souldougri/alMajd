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
await q("INSERT INTO academic_years (id, label, start_date, end_date, is_current, active, created_at) VALUES ('ay1','2026-2027','2026-09-01','2027-06-30',true,true,$1)", [now]);
await q("INSERT INTO academic_years (id, label, start_date, end_date, is_current, active, created_at) VALUES ('ay2','2027-2028','2027-09-01','2028-06-30',false,true,$1)", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c1','b1','ay1','3A',true,$1)", [now]);

// classes unique (branch, year, name)
let e = await expectError(
  "INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c2','b1','ay1','3A',true,$1)",
  [now], /unique|duplicate/i);
assert("class unique (branch, year, name)", e === "ok");
// same name in different branch OK
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c3','b2','ay1','3A',true,$1)", [now]);
assert("same class name allowed in different branch", true);

// class FK -> branch, academic_year
e = await expectError("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c4','nope','ay1','3C',true,$1)", [now], /foreign|constraint/i);
assert("class FK -> branches", e === "ok");

// only one is_current academic year allowed by app invariant (check update guard)
const currentCount = (await q("SELECT COUNT(*) c FROM academic_years WHERE is_current = true"))[0];
assert("exactly one current academic year after fixture", Number(currentCount.c) === 1);

// seed a term for results/assessment fixtures
await q("INSERT INTO terms (id, name_ar, name_fr, \"order\") VALUES ('t1','فصل أول','Trimestre 1', 1)", []);

// class_subjects unique (class, subject)
await q("INSERT INTO subjects (id, code, name_ar, created_at) VALUES ('sx1','MATH','Riyadh', $1)", [now]);
await q("INSERT INTO class_subjects (id, class_id, subject_id, coefficient, max_score) VALUES ('cs1','c1','sx1',2,20)", []);
e = await expectError("INSERT INTO class_subjects (id, class_id, subject_id, coefficient, max_score) VALUES ('cs2','c1','sx1',1,20)", [], /unique|duplicate/i);
assert("class_subjects unique (class, subject)", e === "ok");

// timetable unique (class, day, slot)
await q("INSERT INTO timetable_entries (id, class_id, day, slot, subject_id) VALUES ('tt1','c1',1,1,'sx1')", []);
e = await expectError("INSERT INTO timetable_entries (id, class_id, day, slot, subject_id) VALUES ('tt2','c1',1,1,'sx1')", [], /unique|duplicate/i);
assert("timetable unique (class, day, slot)", e === "ok");

// published_results PK (class, term)
await q("INSERT INTO published_results (class_id, term_id, published, updated_at) SELECT 'c1', id, false, $1 FROM terms LIMIT 1", [now]);
e = await expectError("INSERT INTO published_results (class_id, term_id, published, updated_at) SELECT 'c1', id, true, $1 FROM terms LIMIT 1", [now], /unique|duplicate|conflict/i);
assert("published_results PK (class, term)", e === "ok");

// grades/assessments join validity for later steps: assessment FK checks
await q("INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, created_at) SELECT 'a1','c1','sx1', id, 'quiz', 'Q1', $1 FROM terms LIMIT 1", [now]);
e = await expectError("INSERT INTO assessments (id, class_id, subject_id, term_id, type_code, title, created_at) SELECT 'a2','c1','sx1', id, 'badtype', 'Q2', $1 FROM terms LIMIT 1", [now], /foreign|constraint/i);
assert("assessment FK -> assessment_types", e === "ok");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);