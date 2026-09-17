import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listClassSubjects, setClassSubject } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  subjectId?: unknown;
  coefficient?: unknown;
  maxScore?: unknown;
  active?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/classes/$id/class-subjects")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const items = await listClassSubjects(params.id, user);
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await setClassSubject(
            {
              classId: params.id,
              subjectId: str(body.subjectId) ?? "",
              coefficient: num(body.coefficient),
              maxScore: num(body.maxScore),
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
