import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeTeachingAssignment } from "@/server/assignments";
import { handle, jsonOk } from "@/server/http";
import { requireBranchId } from "@/server/scope";

export const Route = createFileRoute("/api/teaching-assignments/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeTeachingAssignment(requireBranchId(params.id), user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});