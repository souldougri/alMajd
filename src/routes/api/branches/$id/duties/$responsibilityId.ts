import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeBranchResponsibility } from "@/server/assignments";
import { handle, jsonOk } from "@/server/http";
import { requireBranchId } from "@/server/scope";

export const Route = createFileRoute("/api/branches/$id/duties/$responsibilityId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeBranchResponsibility(requireBranchId(params.responsibilityId), user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});