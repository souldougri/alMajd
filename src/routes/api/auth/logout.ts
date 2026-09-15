import { createFileRoute } from "@tanstack/react-router";
import { deleteSessionByToken } from "@/server/auth";
import { handle, jsonOk, readCookie, SESSION_COOKIE, withClearedSessionCookie } from "@/server/http";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await deleteSessionByToken(readCookie(request, SESSION_COOKIE));
          return withClearedSessionCookie(jsonOk({ user: null }));
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});