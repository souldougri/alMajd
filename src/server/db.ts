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

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  staff_id TEXT,
  student_id TEXT,
  duties TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  target_id TEXT,
  target_name TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_documents (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_news (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_fr TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  cover TEXT NOT NULL DEFAULT '',
  news_date TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'general',
  target TEXT NOT NULL,
  user_id TEXT,
  class_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  visibility TEXT NOT NULL,
  class_id TEXT,
  student_id TEXT,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  settings TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_news_date ON site_news(news_date);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- Idempotent migrations for existing databases created before these columns existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS duties TEXT NOT NULL DEFAULT '';
`;

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
  await seedAdminIfMissing(connection);
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