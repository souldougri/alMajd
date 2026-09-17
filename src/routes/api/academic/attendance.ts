import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listAttendance, markAttendance } from "@/server/attendance";
import { handle, jsonOk } from "@/server/http";

type Body = { classId?: unknown; studentId?: unknown; date?: unknown; status?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/attendance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const classId = url.searchParams.get("classId") ?? "";
          const date = url.searchParams.get("date") ?? undefined;
          const items = await listAttendance(user, { classId, date });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await markAttendance(user, {
            classId: str(body.classId) ?? "",
            studentId: str(body.studentId) ?? "",
            date: str(body.date) ?? "",
            status: str(body.status) ?? "present",
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});