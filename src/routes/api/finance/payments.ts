import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createPayment, listPayments } from "@/server/finance";
import { handle, jsonOk } from "@/server/http";

type Body = { id?: unknown; studentId?: unknown; branchId?: unknown; amount?: unknown; date?: unknown; note?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/finance/payments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const studentId = url.searchParams.get("studentId") ?? undefined;
          const items = await listPayments(user, { branchId, studentId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createPayment(user, {
            id: str(body.id),
            studentId: str(body.studentId) ?? "",
            branchId: str(body.branchId) ?? "",
            amount: num(body.amount) ?? 0,
            date: str(body.date) ?? "",
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