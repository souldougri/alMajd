import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { requireBranchAccess } from "@/server/scope";
import { createSubject, listSubjects } from "@/server/academic";
import { handle, jsonOk } from "@/server/http";

type Body = { id?: unknown; code?: unknown; nameAr?: unknown; nameFr?: unknown; branchId?: unknown };

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export const Route = createFileRoute("/api/academic/subjects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const branchId = url.searchParams.get("branchId") ?? undefined;
          if (branchId) await requireBranchAccess(user, branchId);
          const items = await listSubjects(branchId ? { branchId } : undefined);
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
const item = await createSubject(
            { id: str(body.id), code: str(body.code), nameAr: str(body.nameAr) ?? "", nameFr: str(body.nameFr), branchId: str(body.branchId) },
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