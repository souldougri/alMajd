import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createTeachingAssignment, listTeachingAssignments } from "@/server/assignments";
import { handle, jsonOk } from "@/server/http";

type Body = {
  teacherUserId?: unknown;
  classId?: unknown;
  subjectId?: unknown;
  academicYearId?: unknown;
};

export const Route = createFileRoute("/api/teaching-assignments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const teacherUserId = url.searchParams.get("teacherUserId") ?? undefined;
          const classId = url.searchParams.get("classId") ?? undefined;
          const academicYearId = url.searchParams.get("academicYearId") ?? undefined;
          const items = await listTeachingAssignments(user, { teacherUserId, classId, academicYearId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createTeachingAssignment(
            {
              teacherUserId: typeof body.teacherUserId === "string" ? body.teacherUserId : "",
              classId: typeof body.classId === "string" ? body.classId : "",
              subjectId: typeof body.subjectId === "string" ? body.subjectId : "",
              academicYearId: typeof body.academicYearId === "string" ? body.academicYearId : "",
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