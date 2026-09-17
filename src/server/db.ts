/**
 * Database access layer.
 *
 * - Uses PostgreSQL when DATABASE_URL is set.
 * - Otherwise falls back to a local PGLite file under `.data/almajd`
 *   (no external server needed for local development).
 *
 * Server-only module — never import from client code.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { hashPassword, uid } from "./auth";
import { SCHEMA_SQL, SEED_LOOKUPS_SQL } from "./schema";
import { SCHOOL } from "@/lib/school";
import { FIXTURE_STAFF_IDS, FIXTURE_STUDENT_IDS } from "@/data/seed";

export interface DbRow {
  [key: string]: unknown;
}

export type DbResult = { rows: DbRow[] };

export type DbLike = {
  query: (text: string, params?: unknown[]) => Promise<DbResult>;
  exec: (sql: string) => Promise<unknown>;
};

const SEED_ADMIN_EMAIL = "admin@madjd.org";
const DEFAULT_ADMIN_PASSWORD = process.env.ALMAJD_ADMIN_PASSWORD ?? "AlMajd@2026!";
const DATA_DIR = join(process.cwd(), ".data");
const PGLITE_DIR = join(DATA_DIR, "almajd");

let db: DbLike | null = null;
let initPromise: Promise<void> | null = null;

function makePg(): DbLike {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return {
    query: (text, params) => pool.query(text, params) as unknown as Promise<DbResult>,
    exec: (sql) => pool.query(sql) as unknown as Promise<void>,
  };
}

async function makePglite(): Promise<DbLike> {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const pglite = new PGlite(PGLITE_DIR);
  return {
    query: (text, params) => pglite.query(text, params) as unknown as Promise<DbResult>,
    exec: (sql) => pglite.exec(sql),
  };
}

async function seedAdminIfMissing(connection: DbLike): Promise<void> {
  const existing = await connection.query("SELECT id FROM users WHERE email = $1", [SEED_ADMIN_EMAIL.toLowerCase()]);
  if (existing.rows.length > 0) return;

  const now = new Date().toISOString();
  await connection.query(
    `INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
    [
      uid("usr"),
      SEED_ADMIN_EMAIL.toLowerCase(),
      "مدير النظام",
      "System Admin",
      "super_admin",
      hashPassword(DEFAULT_ADMIN_PASSWORD),
      true,
      now,
    ],
  );
  console.info(`[db] Seeded default admin account ${SEED_ADMIN_EMAIL}.`);
}

/**
 * Seeds the baseline organization state on a clean database:
 * - one default branch (keeps the single-branch UI functional until the
 *   dedicated branch-management UI lands), and
 * - the current academic year.
 * Idempotent — safe to run on every startup.
 */
async function seedBaselineOrg(connection: DbLike): Promise<void> {
  const now = new Date().toISOString();
  const branches = await connection.query("SELECT id FROM branches WHERE is_default = true LIMIT 1");
  if (branches.rows.length === 0) {
    await connection.query(
      `INSERT INTO branches (id, name_ar, name_fr, name_en, address, phone, active, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [uid("br"), "الفرع الرئيسي", "Branche principale", "Main Branch", "", "", true, true, now],
    );
    console.info("[db] Seeded default branch.");
  }
  await connection.query(
    `INSERT INTO academic_years (id, label, start_date, end_date, is_current, active, created_at)
     VALUES ($1, $2, NULL, NULL, true, true, $3)
     ON CONFLICT (label) DO NOTHING`,
    [uid("ay"), SCHOOL.year, now],
  );
}

/**
 * One-time cleanup: removes fake seeded staff/demo student rows from any stored
 * school document and clears teacherStaffId references to those fixture IDs,
 * so old desktop fixture names never appear in teacher pickers.
 */
async function stripFixtureRowsFromSchoolDocument(connection: DbLike): Promise<void> {
  const rows = await connection.query("SELECT id, document FROM school_documents");
  for (const row of rows.rows) {
    const doc = row.document;
    if (!doc || typeof doc !== "object") continue;
    const d = doc as {
      students?: Array<{ id: string }>;
      staff?: Array<{ id: string }>;
      payments?: Array<{ studentId: string }>;
      warnings?: Array<{ studentId: string }>;
      attendance?: Record<string, Record<string, unknown>>;
      classes?: Array<{ id: string; teacherStaffId?: string }>;
      subjects?: Array<{ id: string; teacherStaffId?: string }>;
    };
    const students = (d.students ?? []).filter((s) => !FIXTURE_STUDENT_IDS.has(s.id));
    const staff = (d.staff ?? []).filter((s) => !FIXTURE_STAFF_IDS.has(s.id));
    const payments = (d.payments ?? []).filter((p) => !FIXTURE_STUDENT_IDS.has(p.studentId));
    const warnings = (d.warnings ?? []).filter((w) => !FIXTURE_STUDENT_IDS.has(w.studentId));

    const attendance: Record<string, Record<string, unknown>> = {};
    if (d.attendance && typeof d.attendance === "object") {
      for (const [date, dayMap] of Object.entries(d.attendance)) {
        const day: Record<string, unknown> = {};
        for (const [sid, status] of Object.entries(dayMap)) {
          if (!FIXTURE_STUDENT_IDS.has(sid)) day[sid] = status;
        }
        if (Object.keys(day).length > 0) attendance[date] = day;
      }
    }

    const classes = (d.classes ?? []).map((c) => ({
      ...c,
      teacherStaffId: c.teacherStaffId && FIXTURE_STAFF_IDS.has(c.teacherStaffId) ? undefined : c.teacherStaffId,
    }));
    const subjects = (d.subjects ?? []).map((s) => ({
      ...s,
      teacherStaffId: s.teacherStaffId && FIXTURE_STAFF_IDS.has(s.teacherStaffId) ? undefined : s.teacherStaffId,
    }));

    const cleaned = { ...d, students, staff, payments, warnings, attendance, classes, subjects };
    if (JSON.stringify(cleaned) !== JSON.stringify(d)) {
      await connection.query(
        "UPDATE school_documents SET document = $1, updated_at = $2 WHERE id = $3",
        [JSON.stringify(cleaned), new Date().toISOString(), String(row.id)],
      );
      console.info(`[db] Stripped fixture data from school document ${row.id}.`);
    }
  }
}

async function init(): Promise<void> {
  const connection = db ?? (await connect());
  await connection.exec(SCHEMA_SQL);
  await connection.exec(SEED_LOOKUPS_SQL);
  await seedAdminIfMissing(connection);
  await seedBaselineOrg(connection);
  await stripFixtureRowsFromSchoolDocument(connection);
}

async function connect(): Promise<DbLike> {
  db = process.env.DATABASE_URL ? makePg() : await makePglite();
  return db;
}

/**
 * Returns the database connection, initializing schema + admin seed once.
 */
export async function getDb(): Promise<DbLike> {
  if (!initPromise) {
    initPromise = init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
  return db as DbLike;
}

export function getSeedAdminEmail(): string {
  return SEED_ADMIN_EMAIL;
}

export { DEFAULT_ADMIN_PASSWORD };