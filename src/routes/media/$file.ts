import { createFileRoute } from "@tanstack/react-router";
import { readSiteMedia } from "@/server/site";
import { handle } from "@/server/http";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/media/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const buffer = await readSiteMedia(params.file);
          const ext = params.file.slice(params.file.lastIndexOf(".")).toLowerCase();
          const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
          return new Response(new Uint8Array(buffer), {
            headers: {
              "Content-Type": mime,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err) {
          return handle(err);
        }
      },
    },
  },
});