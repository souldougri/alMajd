import { createFileRoute } from "@tanstack/react-router";
import { deleteNewsItem, updateNewsItem, type NewsInput } from "@/server/site";
import { requireAdminFromRequest } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/news/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const user = await requireAdminFromRequest(request);
          const body = (await request.json()) as NewsInput;
          const item = await updateNewsItem(params.id, body, user.nameAr);
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          await requireAdminFromRequest(request);
          await deleteNewsItem(params.id);
          return jsonOk({ deleted: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});