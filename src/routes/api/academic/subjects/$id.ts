import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { updateSubject } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = { code?: unknown; nameAr?: unknown; nameFr?: unknown; active?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/subjects/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await updateSubject(
            params.id,
            {
              code: str(body.code),
              nameAr: str(body.nameAr),
              nameFr: str(body.nameFr),
              active: typeof body.active === "boolean" ? body.active : undefined,
            },
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