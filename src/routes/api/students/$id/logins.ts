import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getStudentLoginStatus } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/students/$id/logins")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          // Login emails only — passwords are never stored nor re-exposed.
          const logins = await getStudentLoginStatus(params.id, user);
          return jsonOk({ logins });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
