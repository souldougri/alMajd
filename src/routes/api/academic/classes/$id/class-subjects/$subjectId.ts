import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { setClassSubject } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/academic/classes/$id/class-subjects/$subjectId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await setClassSubject(
            { classId: params.id, subjectId: params.subjectId },
            user,
            true,
          );
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});