import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { transferClass } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = { toBranchId?: unknown };

export const Route = createFileRoute("/api/academic/classes/$id/transfer")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await transferClass(
            params.id,
            typeof body.toBranchId === "string" ? body.toBranchId : "",
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