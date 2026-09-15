import { createFileRoute } from "@tanstack/react-router";
import { requireAdminFromRequest, resetUserPasswordServer } from "@/server/auth";
import { handle, jsonError, jsonOk } from "@/server/http";

type ResetPasswordBody = { password?: unknown };

export const Route = createFileRoute("/api/users/$id/reset-password")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const actor = await requireAdminFromRequest(request);
          const body = (await request.json()) as ResetPasswordBody;
          if (typeof body.password !== "string") {
            return jsonError("يرجى تحديد كلمة المرور الجديدة");
          }
          const user = await resetUserPasswordServer(params.id, body.password, actor);
          return jsonOk({ user });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});