import { createFileRoute } from "@tanstack/react-router";
import { requireDeskFromRequest, listUsersSafe } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/teachers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireDeskFromRequest(request);
          const allUsers = await listUsersSafe();
          // Filter to only active teacher role users
          const teachers = allUsers.filter((u) => u.role === "teacher" && u.active);
          return jsonOk({ teachers });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
