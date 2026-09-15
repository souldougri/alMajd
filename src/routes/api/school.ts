import { createFileRoute } from "@tanstack/react-router";
import { getSchoolDocumentRow, requireDeskFromRequest, saveSchoolDocumentRow } from "@/server/auth";
import { handle, jsonError, jsonOk } from "@/server/http";
import { CURRENT_SCHEMA_VERSION, validateBackupDocument } from "@/lib/storage";

type SaveSchoolBody = { document?: unknown };

export const Route = createFileRoute("/api/school")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireDeskFromRequest(request);
          const row = await getSchoolDocumentRow();
          if (!row) {
            return jsonOk({ exists: false });
          }
          return jsonOk({ exists: true, schemaVersion: row.schemaVersion, document: row.document, updatedAt: row.updatedAt });
        } catch (err) {
          return handle(err);
        }
      },
      PUT: async ({ request }) => {
        try {
          await requireDeskFromRequest(request);
          const body = (await request.json()) as SaveSchoolBody;
          const validation = validateBackupDocument(body.document);
          if (!validation.success) {
            return jsonError(validation.errorAr);
          }
          // Reject documents newer than what this server understands.
          if (validation.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
            return jsonError(
              `إصدار النسخة الاحتياطية (${validation.data.schemaVersion}) أحدث من إصدار النظام الحالي (${CURRENT_SCHEMA_VERSION}).`,
            );
          }
          const schemaVersion = Number(validation.data.schemaVersion) || CURRENT_SCHEMA_VERSION;
          await saveSchoolDocumentRow(validation.data, schemaVersion);
          return jsonOk({ saved: true, schemaVersion });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});