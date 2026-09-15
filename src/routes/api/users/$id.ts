import { createFileRoute } from "@tanstack/react-router";
import { deleteUserServer, requireAdminFromRequest, updateUserServer } from "@/server/auth";
import { handle, jsonOk } from "@/server/http";
import { parseDuties, type Role, type StaffDuty } from "@/lib/auth/types";

type UpdateUserBody = {
  email?: unknown;
  nameAr?: unknown;
  nameEn?: unknown;
  role?: unknown;
  active?: unknown;
  password?: unknown;
  staffId?: unknown;
  studentId?: unknown;
  duties?: unknown;
};

export const Route = createFileRoute("/api/users/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const actor = await requireAdminFromRequest(request);
          const body = (await request.json()) as UpdateUserBody;
          const updates: {
            email?: string;
            nameAr?: string;
            nameEn?: string;
            role?: Role;
            active?: boolean;
            password?: string;
            staffId?: string | null;
            studentId?: string | null;
            duties?: StaffDuty[] | null;
          } = {};
          if (typeof body.email === "string") updates.email = body.email;
          if (typeof body.nameAr === "string") updates.nameAr = body.nameAr;
          if (typeof body.nameEn === "string") updates.nameEn = body.nameEn;
          if (typeof body.role === "string") updates.role = body.role as Role;
          if (typeof body.active === "boolean") updates.active = body.active;
          if (typeof body.password === "string") updates.password = body.password;
          if ("staffId" in body) updates.staffId = typeof body.staffId === "string" ? body.staffId : null;
          if ("studentId" in body) updates.studentId = typeof body.studentId === "string" ? body.studentId : null;
          if ("duties" in body)
            updates.duties = Array.isArray(body.duties) ? parseDuties(body.duties.join(",")) : null;
          const user = await updateUserServer(params.id, updates, actor);
          return jsonOk({ user });
        } catch (err) {
          return handle(err);
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const actor = await requireAdminFromRequest(request);
          const user = await deleteUserServer(params.id, actor);
          return jsonOk({ user });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});