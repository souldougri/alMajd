import { createFileRoute } from "@tanstack/react-router";
import { requireStudentFromRequest } from "@/server/auth";
import { getStudent } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/students/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireStudentFromRequest(request);
          if (!user.studentId) {
            return jsonOk({ student: null });
          }
          const student = await getStudent(user.studentId, user);
          return jsonOk({ student });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});