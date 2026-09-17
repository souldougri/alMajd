import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createAssessment, listAssessmentTypes, listAssessments } from "@/server/grades";
import { handle, jsonOk } from "@/server/http";

type Body = {
  classId?: unknown;
  subjectId?: unknown;
  termId?: unknown;
  typeCode?: unknown;
  title?: unknown;
  date?: unknown;
  maxScore?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/assessments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const classId = url.searchParams.get("classId") ?? undefined;
          const subjectId = url.searchParams.get("subjectId") ?? undefined;
          const termId = url.searchParams.get("termId") ?? undefined;
          const items = await listAssessments(user, { classId, subjectId, termId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createAssessment(user, {
            classId: str(body.classId) ?? "",
            subjectId: str(body.subjectId) ?? "",
            termId: str(body.termId) ?? "",
            typeCode: str(body.typeCode) ?? "",
            title: str(body.title) ?? "",
            date: str(body.date),
            maxScore: num(body.maxScore),
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});
