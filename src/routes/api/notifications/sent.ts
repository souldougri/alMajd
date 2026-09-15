import { createFileRoute } from "@tanstack/react-router";
import { requireAdminFromRequest } from "@/server/auth";
import { listSentNotifications } from "@/server/notifications";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/notifications/sent")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          return jsonOk({ items: await listSentNotifications() });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});