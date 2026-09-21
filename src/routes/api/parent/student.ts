import { createFileRoute } from "@tanstack/react-router";
import { requireParentFromRequest } from "@/server/auth";
import { getParentLinkedStudent } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/parent/student")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireParentFromRequest(request);
          const student = await getParentLinkedStudent(user.id);
          return jsonOk({ student });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
