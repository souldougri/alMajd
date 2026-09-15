import { createFileRoute } from "@tanstack/react-router";
import { listPublishedNews, createNewsItem, type NewsInput } from "@/server/site";
import { requireAdminFromRequest } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return jsonOk({ items: await listPublishedNews() });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireAdminFromRequest(request);
          const body = (await request.json()) as NewsInput;
          const item = await createNewsItem(body, user.nameAr);
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});