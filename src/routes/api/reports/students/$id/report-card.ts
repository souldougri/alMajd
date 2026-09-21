import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getReportCard } from "@/server/reports";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/reports/students/$id/report-card")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const termId = url.searchParams.get("termId") ?? "";
          return jsonOk({ report: await getReportCard(params.id, termId, user) });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
