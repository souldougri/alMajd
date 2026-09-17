import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createBranch, listBranchesForUser } from "@/server/org";
import { handle, jsonOk } from "@/server/http";

type CreateBody = {
  nameAr?: unknown;
  nameFr?: unknown;
  nameEn?: unknown;
  address?: unknown;
  phone?: unknown;
};

export const Route = createFileRoute("/api/branches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const branches = await listBranchesForUser(user);
          return jsonOk({ branches });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const body = (await request.json()) as CreateBody;
          const branch = await createBranch(
            {
              nameAr: typeof body.nameAr === "string" ? body.nameAr : "",
              nameFr: typeof body.nameFr === "string" ? body.nameFr : undefined,
              nameEn: typeof body.nameEn === "string" ? body.nameEn : undefined,
              address: typeof body.address === "string" ? body.address : undefined,
              phone: typeof body.phone === "string" ? body.phone : undefined,
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