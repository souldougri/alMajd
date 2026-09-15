import { createFileRoute } from "@tanstack/react-router";
import { requireUserFromRequest } from "@/server/auth";
import { downloadDocument } from "@/server/documents";
import { handle } from "@/server/http";

export const Route = createFileRoute("/api/documents/$id/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireUserFromRequest(request);
          const { buffer, filename, mime } = await downloadDocument(user, params.id);
          return new Response(new Uint8Array(buffer), {
            headers: {
              "Content-Type": mime,
              "Content-Disposition": `attachment; filename="download${filename.slice(filename.lastIndexOf("."))}"`,
              "Cache-Control": "private, no-store",
              "Content-Length": String(buffer.byteLength),
            },
          });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});