import { createFileRoute } from "@tanstack/react-router";
import { createUserServer, listUsersSafe, requireAdminFromRequest, requireRegistrarOrAdminFromRequest } from "@/server/auth";
import { ApiError, handle, jsonOk } from "@/server/http";
import { type Role } from "@/lib/auth/types";

type CreateUserBody = {
  email?: unknown;
  nameAr?: unknown;
  nameEn?: unknown;
  role?: unknown;
  active?: unknown;
  initialPassword?: unknown;
  staffId?: unknown;
  studentId?: unknown;
  duties?: unknown;
};

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          return jsonOk({ users: await listUsersSafe() });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const actor = await requireRegistrarOrAdminFromRequest(request);
          const body = (await request.json()) as CreateUserBody;
          const role = typeof body.role === "string" ? (body.role as Role) : "staff";
          const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;

          // Staff accounts may never create user-management entries beyond a
          // bound student login for the registrar workspace.
          if (actor.role !== "super_admin") {
            if (role !== "student" || !studentId) {
              throw new ApiError(
                "غير مصرح لك — يمكن لأمين السجل إنشاء حسابات طلاب مرتبطة بسجل طالب فقط",
                403,
              );
            }
          }

          const user = await createUserServer(
            {
              email: typeof body.email === "string" ? body.email : "",
              nameAr: typeof body.nameAr === "string" ? body.nameAr : "",
              nameEn: typeof body.nameEn === "string" ? body.nameEn : "",
              role,
              active: typeof body.active === "boolean" ? body.active : true,
              initialPassword: typeof body.initialPassword === "string" ? body.initialPassword : "",
              staffId: null,
              studentId,
              duties: [],
            },
            actor,
          );
          return jsonOk({ user });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});