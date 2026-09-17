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
await q("INSERT INTO students (id, name_ar, branch_id, klass, active, created_at, updated_at) VALUES ('st1','طالب','b1','3A',true,$1,$1)", [now]);

// fee_types: FK branch
let e = await expectError("INSERT INTO fee_types (id, branch_id, name_ar, amount) VALUES ('f1','nope','رسوم',500)", [], /foreign|constraint/i);
assert("fee_types FK -> branches", e === "ok");
await q("INSERT INTO fee_types (id, branch_id, name_ar, amount) VALUES ('f1','b1','رسوم التسجيل',150000)", []);
assert("fee_types row persisted", true);

// payments: amount >= 0 and FK student/branch
e = await expectError("INSERT INTO payments (id, student_id, branch_id, amount, date) VALUES ('p1','st1','b1',-10,'2026-01-01')", [], /check/i);
assert("payments CHECK (amount >= 0)", e === "ok");
e = await expectError("INSERT INTO payments (id, student_id, branch_id, amount, date) VALUES ('p2','nope','b1',100,'2026-01-01')", [], /foreign|constraint/i);
assert("payments FK -> students", e === "ok");

// expenses: amount >= 0 and FK branch
e = await expectError("INSERT INTO expenses (id, branch_id, date, amount) VALUES ('x1','b1','2026-01-01',-5)", [], /check/i);
assert("expenses CHECK (amount >= 0)", e === "ok");
e = await expectError("INSERT INTO expenses (id, branch_id, date, amount) VALUES ('x2','nope','2026-01-01',5)", [], /foreign|constraint/i);
assert("expenses FK -> branches", e === "ok");

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);