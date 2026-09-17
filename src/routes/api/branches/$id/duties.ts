import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { assignBranchResponsibility, listBranchResponsibilities } from "@/server/assignments";
import { handle, jsonOk } from "@/server/http";

type Body = { userId?: unknown; dutyCode?: unknown };

export const Route = createFileRoute("/api/branches/$id/duties")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const items = await listBranchResponsibilities(user, { branchId: params.id });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await assignBranchResponsibility(
            params.id,
            typeof body.userId === "string" ? body.userId : "",
            typeof body.dutyCode === "string" ? body.dutyCode : "",
            user,
          );
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});