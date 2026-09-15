import { createFileRoute } from "@tanstack/react-router";
import { requireTeacherFromRequest } from "@/server/auth";
import { getTeacherPortfolio, upsertTeacherGrade } from "@/server/school";
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
          return jsonOk({ portfolio: await getTeacherPortfolio(user) });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireTeacherFromRequest(request);
          const body = (await request.json()) as UpsertGradeBody;
          const result = await upsertTeacherGrade(user, body);
          return jsonOk(result);
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});