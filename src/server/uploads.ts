/**
 * Local file storage helpers for uploaded assets and documents.
 *
 * Files live under `.data/uploads/`:
 *   - `site/`  → publicly served media (news cover images via /media/*)
 *   - `docs/`  → access-controlled document archives served via /api/documents
 *
 * Server-only module — never import from client code.
 */
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { ApiError } from "./http";

export const UPLOADS_ROOT = join(process.cwd(), ".data", "uploads");
export const SITE_MEDIA_DIR = join(UPLOADS_ROOT, "site");
export const DOCS_DIR = join(UPLOADS_ROOT, "docs");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // ~10 MB

/** Extension (with dot) to MIME map for the allowed upload types. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function ensureUploadsDirs(): void {
  for (const dir of [UPLOADS_ROOT, SITE_MEDIA_DIR, DOCS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function siteMediaPath(storedName: string): string {
  return join(SITE_MEDIA_DIR, storedName);
}

export function docFilePath(storedName: string): string {
  return join(DOCS_DIR, storedName);
}

/**
 * Validates a filename's extension and size, returning the normalized MIME.
 * Throws ApiError (surfaced as a clear 4xx to the caller, never a generic
 * server 500) with an Arabic, user-facing message on failure.
 */
export function validateUpload(
  filename: string,
  byteLength: number,
): { ext: string; mime: string } {
  if (!filename || !filename.includes(".")) {
    throw new ApiError("نوع الملف غير مدعوم. الملفات المسموحة: PDF / JPG / PNG / WEBP");
  }
  const ext = extname(filename).toLowerCase();
  const mime = ALLOWED_UPLOAD_TYPES[ext];
  if (!mime) {
    throw new ApiError("نوع الملف غير مدعوم. الملفات المسموحة: PDF / JPG / PNG / WEBP.");
  }
  if (byteLength <= 0) {
    throw new ApiError("الملف فارغ");
  }
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new ApiError(`حجم الملف يتجاوز الحد الأقصى المسموح (10 MB)`);
  }
  return { ext, mime };
}