import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getPublishedResults, setPublishedResults } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  termId?: unknown;
  published?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/classes/$id/results")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const items = await getPublishedResults(params.id, user);
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await setPublishedResults(
            params.id,
            str(body.termId) ?? "",
            typeof body.published === "boolean" ? body.published : false,
            user,
          );
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});