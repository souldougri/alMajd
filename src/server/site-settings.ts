/**
 * Site settings CMS — public-site content stored as a single JSON row
 * (super_admin only to write). Fallback defaults live client-side in
 * `src/lib/site.tsx`, so the public site always renders something.
 *
 * Server-only module — never import from client code.
 */
import { getDb } from "./db";

const SETTINGS_ID = "main";

export type RawSiteSettings = Record<string, unknown>;

/** Returns the stored settings object (empty object when nothing saved yet). */
export async function readSiteSettings(): Promise<RawSiteSettings> {
  const result = await (await getDb()).query(
    "SELECT settings FROM site_settings WHERE id = $1 LIMIT 1",
    [SETTINGS_ID],
  );
  const row = result.rows[0];
  if (!row) return {};
  try {
    const parsed = JSON.parse(String(row.settings)) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as RawSiteSettings)
      : {};
  } catch {
    return {};
  }
}

/** Replaces the stored settings with the given object (full save). */
export async function writeSiteSettings(settings: unknown): Promise<void> {
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    throw new TypeError("site settings must be a plain object");
  }
  const now = new Date().toISOString();
  await (
    await getDb()
  ).query(
    `INSERT INTO site_settings (id, settings, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET settings = $2, updated_at = $3`,
    [SETTINGS_ID, JSON.stringify(settings), now],
  );
}