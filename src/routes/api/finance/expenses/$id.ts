import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeExpense } from "@/server/finance";
import { handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/finance/expenses/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeExpense(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});