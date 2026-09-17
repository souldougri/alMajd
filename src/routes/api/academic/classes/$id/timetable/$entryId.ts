import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeTimetableEntry } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/academic/classes/$id/timetable/$entryId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeTimetableEntry(params.entryId, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});