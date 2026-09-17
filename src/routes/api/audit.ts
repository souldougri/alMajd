import { createFileRoute } from "@tanstack/react-router";
import {
  listAuditLogs,
  requireUserFromRequest,
  writeAudit,
} from "@/server/auth";
import { getUserBranchScope, isAllScope } from "@/server/scope";
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

/** Scoped variant: audit rows restricted to the given set of branch ids. */
async function listAuditLogsForScope(scope: string[], limit = 200): Promise<Array<Record<string, unknown>>> {
  const db = await (await import("@/server/db")).getDb();
  const result = await db.query(
    `SELECT id, action, actor_id, actor_name, target_id, target_name, branch_id, entity_type, detail, created_at
     FROM audit_logs
     WHERE branch_id IS NULL OR branch_id = ANY($1::text[])
     ORDER BY created_at DESC, id DESC LIMIT $2`,
    [scope, Math.min(Math.max(limit, 1), 500)],
  );
  return result.rows.map((row) => ({
    id: String(row.id ?? ""),
    action: String(row.action),
    actorId: String(row.actor_id ?? ""),
    actorName: String(row.actor_name ?? ""),
    targetId: String(row.target_id ?? ""),
    targetName: String(row.target_name ?? ""),
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    entityType: String(row.entity_type ?? ""),
    detail: String(row.detail ?? ""),
    createdAt: String(row.created_at),
  }));
}

export const Route = createFileRoute("/api/audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    limit: typeof search.limit === "string" ? Number(search.limit) : undefined,
  }),
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const scope = await getUserBranchScope(user);
          if (!isAllScope(scope) && branchId && !scope.includes(branchId)) {
            return jsonError("غير مصرح لك للوصول إلى سجل هذا الفرع", 403);
          }
          if (!isAllScope(scope) && !branchId && scope.length > 0) {
            const logs = await listAuditLogsForScope(scope);
            return jsonOk({ logs });
          }
          return jsonOk({ logs: await listAuditLogs(200, branchId) });
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