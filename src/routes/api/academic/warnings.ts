import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createWarning, listWarnings } from "@/server/attendance";
import { handle, jsonOk } from "@/server/http";

type Body = { id?: unknown; studentId?: unknown; branchId?: unknown; kind?: unknown; date?: unknown; body?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/warnings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const studentId = url.searchParams.get("studentId") ?? undefined;
          const items = await listWarnings(user, { branchId, studentId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createWarning(user, {
            id: str(body.id),
            studentId: str(body.studentId) ?? "",
            branchId: str(body.branchId) ?? "",
            kind: str(body.kind) ?? "absence",
            date: str(body.date) ?? "",
            body: str(body.body),
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});