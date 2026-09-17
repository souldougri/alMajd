import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeGrade } from "@/server/grades";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/academic/grades/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeGrade(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});