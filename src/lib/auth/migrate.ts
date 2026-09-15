import { api } from "@/lib/api";

/**
 * One-time migration of legacy localStorage users (almajd-users) into the
 * server database. Runs only for super_admin, only once per browser profile.
 *
 * Legacy accounts were hashed with the old non-crypto `simpleHash`, so their
 * passwords cannot be carried over. Imported accounts keep their name, email
 * and role, but receive an unknown random password — the super admin must
 * reset each imported password from the user management screen before that
 * account can be used.
 */
const USERS_KEY = "almajd-users";
const MIGRATED_FLAG = "almajd-users-migrated";

export async function migrateLegacyUsers(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }
    const payload = parsed.map((u) => {
      const rec = u as Record<string, unknown>;
      return {
        email: typeof rec.email === "string" ? rec.email : "",
        nameAr: typeof rec.nameAr === "string" ? rec.nameAr : "",
        nameEn: typeof rec.nameEn === "string" ? rec.nameEn : "",
        role: typeof rec.role === "string" ? rec.role : "staff",
        active: typeof rec.active === "boolean" ? rec.active : true,
      };
    });
    const res = await api.post<{ imported: number; skipped: number }>("/api/users/migrate", { users: payload });
    if (res.ok) {
      localStorage.setItem(MIGRATED_FLAG, "1");
    }
  } catch {
    /* best-effort migration */
  }
}