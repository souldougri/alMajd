import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getClass, updateClass } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  nameAr?: unknown;
  nameFr?: unknown;
  level?: unknown;
  section?: unknown;
  capacity?: unknown;
  headTeacherUserId?: unknown;
  active?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/classes/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const item = await getClass(params.id, user);
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await updateClass(
            params.id,
            {
              nameAr: str(body.nameAr),
              nameFr: str(body.nameFr),
              level: str(body.level),
              section: str(body.section),
              capacity: num(body.capacity),
              headTeacherUserId: str(body.headTeacherUserId),
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