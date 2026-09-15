import { createFileRoute } from "@tanstack/react-router";
import { uid, writeAudit } from "@/server/auth";
import { getDb } from "@/server/db";
import { handle, jsonError, jsonOk } from "@/server/http";

type ContactBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  message?: unknown;
};

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ContactBody;
          const name = typeof body.name === "string" ? body.name.trim() : "";
          const email = typeof body.email === "string" ? body.email.trim() : "";
          const subject = typeof body.subject === "string" ? body.subject.trim() : "";
          const message = typeof body.message === "string" ? body.message.trim() : "";
          if (!name || !email || !subject || !message) {
            return jsonError("يرجى ملء الحقول المطلوبة (الاسم، البريد، الموضوع، الرسالة).");
          }
          const phone = typeof body.phone === "string" ? body.phone.trim() : "";
          const id = uid("cm");
          await (
            await getDb()
          ).query(
            `INSERT INTO contact_messages (id, name, email, phone, subject, message, read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, name, email, phone || null, subject, message, false, new Date().toISOString()],
          );
          return jsonOk({ id });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});