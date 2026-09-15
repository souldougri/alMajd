import { createFileRoute } from "@tanstack/react-router";
import { getSafeUserFromRequest } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getSafeUserFromRequest(request);
          return jsonOk({ user });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});