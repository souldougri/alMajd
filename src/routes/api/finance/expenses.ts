import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createExpense, listExpenses } from "@/server/finance";
import { handle, jsonOk } from "@/server/http";

type Body = { id?: unknown; branchId?: unknown; date?: unknown; category?: unknown; amount?: unknown; note?: unknown; vendor?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/finance/expenses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const items = await listExpenses(user, { branchId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createExpense(user, {
            id: str(body.id),
            branchId: str(body.branchId) ?? "",
            date: str(body.date) ?? "",
            category: str(body.category) ?? "",
            amount: num(body.amount) ?? 0,
            note: str(body.note),
            vendor: str(body.vendor),
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});