import { createFileRoute } from "@tanstack/react-router";
import { listAuditLogs, requireAdminFromRequest } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

type SearchQuery = { limit?: unknown };

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
    },
  },
});