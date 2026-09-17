import { createFileRoute } from "@tanstack/react-router";
import { requireStudentFromRequest } from "@/server/auth";
import { getStudentPortfolioRelational } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/student")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireStudentFromRequest(request);
          if (!user.studentId) {
            return jsonOk({ portfolio: null });
          }
          const portfolio = await getStudentPortfolioRelational(user.studentId, user);
          return jsonOk({ portfolio });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});