import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getClassStudentList } from "@/server/reports";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/reports/classes/$id/students")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          return jsonOk({ roster: await getClassStudentList(params.id, user) });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
