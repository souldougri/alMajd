import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { assignFinancialOfficer, removeFinancialOfficer } from "@/server/org";
import { handle, jsonOk } from "@/server/http";

type Body = { userId?: unknown };

export const Route = createFileRoute("/api/branches/$id/financial-officer")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          await assignFinancialOfficer(params.id, typeof body.userId === "string" ? body.userId : "", user);
          return jsonOk({ assigned: true });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeFinancialOfficer(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});