import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { assignTeacherToBranch, listTeacherBranchAssignments, removeTeacherFromBranch } from "@/server/assignments";
import { handle, jsonOk } from "@/server/http";
import { requireBranchId } from "@/server/scope";

type Body = { userId?: unknown };

export const Route = createFileRoute("/api/branches/$id/teachers")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const items = await listTeacherBranchAssignments(user, { branchId: params.id });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await assignTeacherToBranch(params.id, typeof body.userId === "string" ? body.userId : "", user);
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()).catch(() => ({})) as Body;
          const userId = typeof body.userId === "string" ? body.userId : "";
          await removeTeacherFromBranch(requireBranchId(params.id), requireBranchId(userId), user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});