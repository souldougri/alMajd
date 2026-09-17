import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { updateAcademicYear } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = { label?: unknown; startDate?: unknown; endDate?: unknown; isCurrent?: unknown; active?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/years/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await updateAcademicYear(
            params.id,
            {
              label: str(body.label),
              startDate: str(body.startDate),
              endDate: str(body.endDate),
              isCurrent: typeof body.isCurrent === "boolean" ? body.isCurrent : undefined,
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