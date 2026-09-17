import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { transferStudent } from "@/server/students";
import { handle, jsonOk } from "@/server/http";

type Body = {
  toBranchId?: unknown;
  effectiveDate?: unknown;
  reason?: unknown;
  toClassId?: unknown;
  academicYearId?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/students/$id/transfer")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const result = await transferStudent(
            params.id,
            typeof body.toBranchId === "string" ? body.toBranchId : "",
            user,
            {
              effectiveDate: str(body.effectiveDate),
              reason: str(body.reason),
              toClassId: str(body.toClassId),
              academicYearId: str(body.academicYearId),
            },
          );
          return jsonOk(result);
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});