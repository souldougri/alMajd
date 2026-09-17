import { createFileRoute } from "@tanstack/react-router";
import { requireTeacherFromRequest } from "@/server/auth";
import { getTeacherPortfolioRelational, upsertTeacherGradeRelational } from "@/server/teacher-portal";
import { handle, jsonOk } from "@/server/http";

type UpsertGradeBody = {
  studentId?: unknown;
  subjectId?: unknown;
  termId?: unknown;
  score?: unknown;
};

export const Route = createFileRoute("/api/teacher")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireTeacherFromRequest(request);
          return jsonOk({ portfolio: await getTeacherPortfolioRelational(user) });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireTeacherFromRequest(request);
          const body = (await request.json()) as UpsertGradeBody;
          const result = await upsertTeacherGradeRelational(user, body);
          return jsonOk(result);
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});