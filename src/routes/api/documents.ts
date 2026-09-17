import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { createDocument, listDocumentsForUser } from "@/server/documents";
import { handle, jsonError, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/documents")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const url = new URL(request.url);
          const classId = url.searchParams.get("classId") ?? undefined;
          const studentId = url.searchParams.get("studentId") ?? undefined;
          const branchId = url.searchParams.get("branchId") ?? undefined;
          const items = await listDocumentsForUser(user, { classId, studentId, branchId });
          return jsonOk({ items });
        } catch (err) {
          return handle(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUserFromRequest(request);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return jsonError("ارفق ملفًا واحدًا");
          }
          const bytes = Buffer.from(await file.arrayBuffer());
          const item = await createDocument(user, {
            title: form.get("title"),
            category: form.get("category"),
            visibility: form.get("visibility"),
            classId: form.get("classId"),
            studentId: form.get("studentId"),
            branchId: form.get("branchId"),
            filename: file.name,
            mime: file.type || "application/octet-stream",
            byteLength: file.size,
            bytes,
          });
          return jsonOk({ item });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});