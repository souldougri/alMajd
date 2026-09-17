import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { promoteStudent } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

type Body = {
  toClassId?: unknown;
  academicYearId?: unknown;
  note?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/students/$id/promote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const enrollment = await promoteStudent(
            params.id,
            typeof body.toClassId === "string" ? body.toClassId : "",
            user,
            {
              academicYearId: str(body.academicYearId),
              note: str(body.note),
            },
          );
          return jsonOk({ enrollment });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});