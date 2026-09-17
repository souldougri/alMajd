import { createFileRoute } from "@tanstack/react-router";
import { requireDeskFromRequest } from "@/server/auth";
import { listTeachers } from "@/server/teachers";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/teachers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireDeskFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const teachers = await listTeachers(user, { branchId });
          return jsonOk({ teachers });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});