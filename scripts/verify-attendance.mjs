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
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, active, created_at) VALUES ('c1','b1','ay1','3A',true,$1)", [now]);
await q("INSERT INTO students (id, name_ar, branch_id, klass, active, created_at, updated_at) VALUES ('st1','طالب','b1','3A',true,$1,$1)", [now]);
await q("INSERT INTO student_class_enrollments (id, student_id, class_id, academic_year_id, status, is_current) VALUES ('e1','st1','c1','ay1','enrolled',true)", []);

// attendance: UNIQUE(class_id, student_id, date)
await q("INSERT INTO attendance (id, class_id, student_id, date, status, created_at) VALUES ('att1','c1','st1','2026-09-10','present',$1)", [now]);
let e = await expectError("INSERT INTO attendance (id, class_id, student_id, date, status, created_at) VALUES ('att2','c1','st1','2026-09-10','absent',$1)", [now], /unique|duplicate/i);
assert("attendance unique (class, student, date)", e === "ok");

// attendance CHECK status
e = await expectError("INSERT INTO attendance (id, class_id, student_id, date, status, created_at) VALUES ('att3','c1','st1','2026-09-11','unknown',$1)", [now], /check|constraint/i);
assert("attendance CHECK status", e === "ok");

// warnings: FK branch and CHECK kind
await q("INSERT INTO warnings (id, student_id, branch_id, kind, date) VALUES ('w1','st1','b1','absence','2026-09-10')", []);
e = await expectError("INSERT INTO warnings (id, student_id, branch_id, kind, date) VALUES ('w2','st1','b1','unknown','2026-09-10')", [], /check|constraint/i);
assert("warnings CHECK kind", e === "ok");
e = await expectError("INSERT INTO warnings (id, student_id, branch_id, kind, date) VALUES ('w3','st1','nope','absence','2026-09-10')", [], /foreign|constraint/i);
assert("warnings FK -> branches", e === "ok");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);