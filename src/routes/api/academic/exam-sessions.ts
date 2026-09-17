import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createExamSession, listExamSessions } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = {
  id?: unknown;
  branchId?: unknown;
  termId?: unknown;
  name?: unknown;
  date?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/exam-sessions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const termId = url.searchParams.get("termId") ?? undefined;
          const items = await listExamSessions(user, { branchId, termId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createExamSession(
            {
              id: str(body.id),
              branchId: str(body.branchId) ?? "",
              termId: str(body.termId) ?? "",
              name: str(body.name) ?? "",
              date: str(body.date) ?? "",
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