import { createFileRoute } from "@tanstack/react-router";
import { listAllNews } from "@/server/site";
import { requireAdminFromRequest } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/news/manage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          return jsonOk({ items: await listAllNews() });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});