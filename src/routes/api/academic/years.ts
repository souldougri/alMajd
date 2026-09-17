import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createAcademicYear, listAcademicYears } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = { label?: unknown; startDate?: unknown; endDate?: unknown; isCurrent?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/years")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireUserFromRequest(request);
          const items = await listAcademicYears();
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createAcademicYear(
            { label: str(body.label) ?? "", startDate: str(body.startDate), endDate: str(body.endDate), isCurrent: typeof body.isCurrent === "boolean" ? body.isCurrent : undefined },
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