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

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log("  ok  " + name); }
  else { failed++; console.error("FAIL  " + name); }
}

const q = async (sql, params) => (await db.query(sql, params)).rows;
const now = new Date().toISOString();

await q("INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ($1,$2,true,true,$3,$3)", ["b1", "b-main", now]);
await q("INSERT INTO branches (id, name_ar, active, is_default, created_at, updated_at) VALUES ($1,$2,true,false,$3,$3)", ["b2", "b-two", now]);

await q(`INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, duties, created_at, updated_at) VALUES ($1,$2,$3,'', 'staff','x',true,'', $4,$4)`, ["u1", "u1@t", "U", now]);
await q(`INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, duties, created_at, updated_at) VALUES ($1,$2,$3,'', 'teacher','x',true,'', $4,$4)`, ["u2", "u2@t", "T", now]);

await q("INSERT INTO academic_years (id, label, is_current, active, created_at) SELECT 'ay1', '2026-2027', true, true, $1 ON CONFLICT (id) DO NOTHING", [now]);
await q("INSERT INTO classes (id, branch_id, academic_year_id, name_ar, created_at) VALUES ('c1', 'b1', 'ay1', '3A', $1)", [now]);
await q("INSERT INTO subjects (id, code, name_ar, created_at) VALUES ('s1', 'MATH', 'Math', $1) ON CONFLICT (code) DO NOTHING", [now]);

async function expectError(sql, params) {
  try { await q(sql, params); return null; }
  catch (e) { return e.message; }
}

// user_branch_assignments duplicate guard
await q("INSERT INTO user_branch_assignments (id, user_id, branch_id, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5)", ["uba1", "u1", "b1", "u1", now]);
let e = await expectError("INSERT INTO user_branch_assignments (id, user_id, branch_id, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5)", ["uba2", "u1", "b1", "u1", now]);
assert("user_branch unique (user,branch)", e !== null && /unique|duplicate/i.test(e));

// branch_responsibilities duplicate + duty FK
await q("INSERT INTO branch_responsibilities (id, user_id, branch_id, duty_code, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5,$6)", ["brs1", "u1", "b1", "registrar", "u1", now]);
e = await expectError("INSERT INTO branch_responsibilities (id, user_id, branch_id, duty_code, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5,$6)", ["brs2", "u1", "b1", "registrar", "u1", now]);
assert("branch_responsibilities unique (user,branch,duty)", e !== null && /unique|duplicate/i.test(e));
e = await expectError("INSERT INTO branch_responsibilities (id, user_id, branch_id, duty_code, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5,$6)", ["brs3", "u1", "b1", "nonexistent-duty", "u1", now]);
assert("branch_responsibilities FK -> duties", e !== null && /foreign|constraint/i.test(e));

// teacher_branch_assignments duplicate
await q("INSERT INTO teacher_branch_assignments (id, teacher_user_id, branch_id, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5)", ["tba1", "u2", "b1", "u1", now]);
await q("INSERT INTO teacher_branch_assignments (id, teacher_user_id, branch_id, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5)", ["tba2", "u2", "b2", "u1", now]);
e = await expectError("INSERT INTO teacher_branch_assignments (id, teacher_user_id, branch_id, assigned_by_user_id, assigned_at) VALUES ($1,$2,$3,$4,$5)", ["tba3", "u2", "b1", "u1", now]);
assert("teacher_branch unique (teacher,branch); multi-branch allowed", e !== null && /unique|duplicate/i.test(e));
const tbaCount = (await q("SELECT COUNT(*) c FROM teacher_branch_assignments WHERE teacher_user_id = 'u2'"))[0].c;
assert("teacher assigned to 2 branches", Number(tbaCount) === 2);

// teaching_assignments unique
await q("INSERT INTO teaching_assignments (id, teacher_user_id, class_id, subject_id, academic_year_id, assigned_by_user_id, assigned_at) SELECT 'ta1','u2','c1','s1',id,'u1',$1 FROM academic_years LIMIT 1", [now]);
e = await expectError("INSERT INTO teaching_assignments (id, teacher_user_id, class_id, subject_id, academic_year_id, assigned_by_user_id, assigned_at) SELECT 'ta2','u2','c1','s1',id,'u1',$1 FROM academic_years LIMIT 1", [now]);
assert("teaching_assignments unique (teacher,class,subject,year)", e !== null && /unique|duplicate/i.test(e));

// scope UNION source tables exist and join (sanity: scope resolver shape)
await q("INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_at) VALUES ('bh1','b2','u1',true,$1)", [now]);
const scope = await q(`SELECT DISTINCT branch_id FROM (
  SELECT branch_id FROM user_branch_assignments WHERE user_id = 'u1'
  UNION ALL
  SELECT branch_id FROM teacher_branch_assignments WHERE teacher_user_id = 'u1'
  UNION ALL
  SELECT branch_id FROM branch_heads WHERE user_id = 'u1' AND active = true
  UNION ALL
  SELECT branch_id FROM branch_financial_officers WHERE financial_officer_user_id = 'u1'
) s ORDER BY branch_id`);
assert("scope UNION sees membership + head rows", scope.length === 2 && scope[0].branch_id === "b1" && scope[1].branch_id === "b2");

// branch heads: one active branch head per branch, one branch per head
let eh = await expectError("INSERT INTO branch_heads (id, branch_id, user_id, active, appointed_at) VALUES ('bh2','b2','u2',true,$1)", [now]);
assert("branch_heads unique active per branch", eh !== null && /unique|duplicate/i.test(eh));

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);