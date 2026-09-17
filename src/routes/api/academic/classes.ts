import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createClass, listClasses } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  id?: unknown;
  branchId?: unknown;
  academicYearId?: unknown;
  nameAr?: unknown;
  nameFr?: unknown;
  level?: unknown;
  section?: unknown;
  capacity?: unknown;
  headTeacherUserId?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/classes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const academicYearId = url.searchParams.get("academicYearId") ?? undefined;
          const includeInactive = url.searchParams.get("includeInactive") === "1";
          const items = await listClasses(user, { branchId, academicYearId, includeInactive });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
const item = await createClass(
            {
              id: str(body.id),
              branchId: str(body.branchId) ?? "",
              academicYearId: str(body.academicYearId) ?? "",
              nameAr: str(body.nameAr) ?? "",
              nameFr: str(body.nameFr),
              level: str(body.level),
              section: str(body.section),
              capacity: num(body.capacity),
              headTeacherUserId: str(body.headTeacherUserId),
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