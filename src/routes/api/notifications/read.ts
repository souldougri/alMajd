import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { markNotificationsRead } from "@/server/notifications";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/notifications/read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as { ids?: string[] };
          const result = await markNotificationsRead(user, body.ids);
          return jsonOk(result);
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});