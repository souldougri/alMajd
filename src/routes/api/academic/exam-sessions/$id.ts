import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { deleteExamSession } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/academic/exam-sessions/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await deleteExamSession(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
