import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { updateBranch } from "@/server/org";
import { handle, jsonOk } from "@/server/http";

type Body = {
  [key: string]: unknown;
};

function pickString(body: Body, key: string): string | undefined {
  const v = body[key];
  return typeof v === "string" ? v : undefined;
}

export const Route = createFileRoute("/api/branches/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as Body;
          const branch = await updateBranch(
            params.id,
            {
              nameAr: pickString(body, "nameAr"),
              nameFr: pickString(body, "nameFr"),
              nameEn: pickString(body, "nameEn"),
              address: pickString(body, "address"),
              phone: pickString(body, "phone"),
              active: typeof body.active === "boolean" ? body.active : undefined,
            },
            user,
          );
          return jsonOk({ branch });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});