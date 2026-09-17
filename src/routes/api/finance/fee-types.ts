import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createFeeType, listFeeTypes } from "@/server/finance";
import { handle, jsonOk } from "@/server/http";

type Body = { id?: unknown; branchId?: unknown; nameAr?: unknown; amount?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/finance/fee-types")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const includeInactive = url.searchParams.get("includeInactive") === "1";
          const items = await listFeeTypes(user, { branchId, includeInactive });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await createFeeType(user, {
            id: str(body.id),
            branchId: str(body.branchId) ?? "",
            nameAr: str(body.nameAr) ?? "",
            amount: num(body.amount) ?? 0,
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});