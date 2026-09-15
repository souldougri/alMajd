import { createFileRoute } from "@tanstack/react-router";
import { requireAdminFromRequest, uid } from "@/server/auth";
import { handle, jsonError, jsonOk } from "@/server/http";
import { ensureUploadsDirs, siteMediaPath } from "@/server/uploads";
import { writeFile } from "node:fs/promises";

export const Route = createFileRoute("/api/media/cover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || file.size <= 0) {
            return jsonError("ارفق صورة الغلاف");
          }
          if (![".jpg", ".jpeg", ".png", ".webp"].includes(getExt(file.name))) {
            return jsonError("صورة الغلاف يجب أن تكون JPG / PNG / WEBP");
          }
          if (file.size > 10 * 1024 * 1024) {
            return jsonError("حجم الصورة يتجاوز الحد الأقصى المسموح (10 MB)");
          }
          const ext = getExt(file.name);
          const storedName = `${uid("cov")}${ext}`;
          ensureUploadsDirs();
          const bytes = Buffer.from(await file.arrayBuffer());
          await writeFile(siteMediaPath(storedName), bytes);
          return jsonOk({ url: `/media/${storedName}` });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});

function getExt(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}