import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { setDocumentArchived } from "@/server/documents";
import { handle, jsonError, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/documents/$id/archive")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as { archived?: boolean };
          if (typeof body.archived !== "boolean") {
            return jsonError("يرجى تحديد حالة الأرشيف");
          }
          const item = await setDocumentArchived(user, params.id, body.archived);
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});