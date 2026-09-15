import { createFileRoute } from "@tanstack/react-router";
import { readSiteSettings, writeSiteSettings } from "@/server/site-settings";
import { requireAdminFromRequest } from "@/server/auth";
import { handle, jsonError, jsonOk } from "@/server/http";

export const Route = createFileRoute("/api/site-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return jsonOk({ settings: await readSiteSettings() });
        } catch (err) {
          return handle(err);
        }
      },
      PUT: async ({ request }) => {
        try {
          await requireAdminFromRequest(request);
          const body = (await request.json()) as Record<string, unknown>;
          if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return jsonError("البيانات المرسلة غير صالحة");
          }
          await writeSiteSettings(body);
          return jsonOk({ settings: body });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});