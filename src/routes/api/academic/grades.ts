import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listGrades, upsertGrade } from "@/server/grades";
import { handle, jsonOk } from "@/server/http";

type Body = {
  studentId?: unknown;
  assessmentId?: unknown;
  score?: unknown;
  note?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/grades")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const assessmentId = url.searchParams.get("assessmentId") ?? undefined;
          const studentId = url.searchParams.get("studentId") ?? undefined;
          const items = await listGrades(user, { assessmentId, studentId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await upsertGrade(user, {
            studentId: str(body.studentId) ?? "",
            assessmentId: str(body.assessmentId) ?? "",
            score: num(body.score) ?? 0,
            note: str(body.note),
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
