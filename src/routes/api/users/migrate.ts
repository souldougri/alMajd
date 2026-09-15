import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { hashPassword, requireAdminFromRequest, uid, writeAudit } from "@/server/auth";
import { getDb } from "@/server/db";
import { handle, jsonOk } from "@/server/http";
import { ROLE_LABELS, type Role } from "@/lib/auth/types";

type LegacyUserPayload = {
  email?: unknown;
  nameAr?: unknown;
  nameEn?: unknown;
  role?: unknown;
  active?: unknown;
};

type MigrateBody = { users?: unknown };

export const Route = createFileRoute("/api/users/migrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const actor = await requireAdminFromRequest(request);
          const db = await getDb();
          const body = (await request.json()) as MigrateBody;
          const payloads = Array.isArray(body.users) ? (body.users as LegacyUserPayload[]) : [];

          let imported = 0;
          let skipped = 0;
          const now = new Date().toISOString();

          for (const item of payloads) {
            if (!item || typeof item !== "object") {
              skipped++;
              continue;
            }
            const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
            if (!email) {
              skipped++;
              continue;
            }
            const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
            if (existing.rows.length > 0) {
              skipped++;
              continue;
            }
            const role: Role = typeof item.role === "string" && item.role in ROLE_LABELS ? (item.role as Role) : "staff";
            const nameAr = typeof item.nameAr === "string" && item.nameAr.trim() ? item.nameAr.trim() : email;
            const nameEn = typeof item.nameEn === "string" ? item.nameEn.trim() : "";
            const active = typeof item.active === "boolean" ? item.active : true;
            // The legacy simpleHash cannot be verified with bcrypt, so these
            // accounts are imported with an unknown random password; the admin
            // must reset each password before the account can be used.
            const randomPassword = randomBytes(18).toString("base64url");
            const id = uid("usr");
            await db.query(
              `INSERT INTO users (id, email, name_ar, name_en, role, password_hash, active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
              [id, email, nameAr, nameEn, role, hashPassword(randomPassword), active, now],
            );
            await writeAudit({
              action: "user.migrate",
              actorId: actor.id,
              actorName: actor.nameAr,
              targetId: id,
              targetName: nameAr,
              detail: `legacy localStorage account imported (role=${role}) — password reset required`,
            });
            imported++;
          }

          return jsonOk({ imported, skipped });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});