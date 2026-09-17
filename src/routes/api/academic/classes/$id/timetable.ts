import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { listTimetable, upsertTimetableEntry } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  day?: unknown;
  slot?: unknown;
  subjectId?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/academic/classes/$id/timetable")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const items = await listTimetable(params.id, user);
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await upsertTimetableEntry(
            {
              classId: params.id,
              day: num(body.day) ?? 0,
              slot: num(body.slot) ?? 0,
              subjectId: str(body.subjectId) ?? "",
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
