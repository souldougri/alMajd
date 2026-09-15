import { createFileRoute } from "@tanstack/react-router";
import { requireStudentFromRequest } from "@/server/auth";
import { getStudentPortfolio } from "@/server/school";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/student")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireStudentFromRequest(request);
          return jsonOk({ portfolio: await getStudentPortfolio(user) });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});