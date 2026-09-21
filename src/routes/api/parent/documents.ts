import { createFileRoute } from "@tanstack/react-router";
import { requireParentFromRequest } from "@/server/auth";
import { listParentDocuments } from "@/server/documents";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/parent/documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireParentFromRequest(request);
          const items = await listParentDocuments(user.id);
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
