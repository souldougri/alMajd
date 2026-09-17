import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listAssessmentTypes } from "@/server/grades";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/academic/assessment-types")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireUserFromRequest(request);
          const items = await listAssessmentTypes();
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
