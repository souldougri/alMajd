import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getAdmissionDocument } from "@/server/reports";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/reports/students/$id/admission")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          return jsonOk({ document: await getAdmissionDocument(params.id, user) });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
