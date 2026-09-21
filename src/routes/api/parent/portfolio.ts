import { createFileRoute } from "@tanstack/react-router";
import { requireParentFromRequest } from "@/server/auth";
import { getParentStudentPortfolio } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/parent/portfolio")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireParentFromRequest(request);
          const portfolio = await getParentStudentPortfolio(user.id);
          return jsonOk({ portfolio });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
