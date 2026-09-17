import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { removeFeeType, updateFeeType } from "@/server/finance";
import { handle, jsonOk } from "@/server/http";

type Body = { nameAr?: unknown; amount?: unknown; active?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/api/finance/fee-types/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const item = await updateFeeType(params.id, user, {
            nameAr: str(body.nameAr),
            amount: num(body.amount),
            active: typeof body.active === "boolean" ? body.active : undefined,
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          await removeFeeType(params.id, user);
          return jsonOk({ removed: true });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});