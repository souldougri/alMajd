import { createFileRoute } from "@tanstack/react-router";
import { requireAdminFromRequest, requireUserFromRequest } from "@/server/auth";
import { composeNotification, listNotificationsForUser, type NotificationComposeInput } from "@/server/notifications";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          return jsonOk(await listNotificationsForUser(user));
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const actor = await requireAdminFromRequest(request);
          const body = (await request.json()) as NotificationComposeInput;
          const notification = await composeNotification(body, actor);
          return jsonOk({ notification });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});