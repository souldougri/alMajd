import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { getTeacher } from "@/server/teachers";
import { ApiError, handle, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/teachers/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          if (user.role === "teacher" && user.id !== params.id) {
            throw new ApiError("غير مصرح لك — يمكنك الاطلاع على ملفك فقط", 403);
          }
          if (user.role !== "teacher" && user.role !== "super_admin" && user.role !== "staff") {
            throw new ApiError("غير مصرح لك", 403);
          }
          const teacher = await getTeacher(params.id, user);
          return jsonOk({ teacher });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});