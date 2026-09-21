import { createFileRoute } from "@tanstack/react-router";
import { requireParentFromRequest } from "@/server/auth";
import { downloadParentDocument } from "@/server/documents";
import { handle } from "@/server/http";

export const Route = createFileRoute("/api/parent/documents/$id/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await requireParentFromRequest(request);
          const { buffer, filename, mime } = await downloadParentDocument(user.id, params.id);
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
