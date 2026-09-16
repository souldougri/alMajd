import { createFileRoute } from "@tanstack/react-router";
import {
  listAuditLogs,
  requireAdminFromRequest,
  requireUserFromRequest,
  writeAudit,
} from "@/server/auth";
import { handle, jsonError, jsonOk } from "@/server/http";
import type {
  AuditAction,
} from "@/lib/audit";

type SearchQuery = { limit?: unknown };

const CLIENT_ACTIONS = new Set<AuditAction>([
  "student.update",
  "student.delete",
  "class.create",
  "class.update",
  "class.delete",
  "class.transfer",
  "subject.create",
  "subject.update",
  "subject.delete",
  "grade.entry",
  "payment.add",
  "warning.add",
  "attendance.mark",
  "expense.add",
  "document.generate",
  "bulletin.publish",
]);

export const Route = createFileRoute("/api/audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    limit: typeof search.limit === "string" ? Number(search.limit) : undefined,
  }),
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          return jsonOk({ logs: await listAuditLogs() });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const actor = await requireUserFromRequest(request);
          const body = (await request.json()) as {
            action?: unknown;
            targetId?: unknown;
            targetName?: unknown;
            detail?: unknown;
          };
          const action = typeof body.action === "string" ? body.action : "";
          if (!CLIENT_ACTIONS.has(action as AuditAction)) {
            return jsonError("إجراء غير مسموح لتسجيل التدقيق", 400);
          }
          await writeAudit({
            action: action as AuditAction,
            actorId: actor.id,
            actorName: actor.nameAr,
            targetId: typeof body.targetId === "string" ? body.targetId : undefined,
            targetName: typeof body.targetName === "string" ? body.targetName : undefined,
            detail: typeof body.detail === "string" ? body.detail.slice(0, 400) : undefined,
          });
          return jsonOk({ ok: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});