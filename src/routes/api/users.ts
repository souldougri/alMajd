import { createFileRoute } from "@tanstack/react-router";
import { createUserServer, deactivateStudentUserServer, listUsersSafe, requireAdminFromRequest, requireRegistrarOrAdminFromRequest, upsertStudentUserServer } from "@/server/auth";
import { ApiError, handle, jsonOk } from "@/server/http";
import { composeNotification } from "@/server/notifications";
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
  disableLogin?: unknown;
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

          // Bound student login deactivation when a student record is removed.
          if (body.disableLogin === true) {
            if (!studentId) {
              throw new ApiError("حدد الطالب المراد تعطيل حسابه");
            }
            return jsonOk(await deactivateStudentUserServer(studentId, actor));
          }

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

          const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
          const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
          const email = typeof body.email === "string" ? body.email.trim() : "";
          const active = typeof body.active === "boolean" ? body.active : true;
          const initialPassword = typeof body.initialPassword === "string" ? body.initialPassword : "";

          // Bound student logins (registrar workspace): idempotent creation
          // with optimistic login id generation when no email is provided.
          if (role === "student" && studentId) {
            const result = await upsertStudentUserServer(
              { nameAr, nameEn, email, initialPassword, studentId, active },
              actor,
            );
            if (result.created) {
              // Automatic broadcast so the whole administration sees the new
              // registration without any manual notification step.
              await composeNotification(
                {
                  title: "تسجيل طالب جديد",
                  body: `تم تسجيل الطالب ${result.user.nameAr} (${result.user.email}) — حُدِّثت الإحصائيات تلقائيًا.`,
                  type: "general",
                  target: "all_staff",
                },
                actor,
              );
            }
            return jsonOk({
              user: result.user,
              login: { email: result.email, password: result.password, created: result.created },
            });
          }

          const user = await createUserServer(
            {
              email,
              nameAr,
              nameEn,
              role,
              active,
              initialPassword,
              staffId: null,
              studentId: null,
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