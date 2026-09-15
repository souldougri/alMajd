/**
 * Site CMS — news items (super_admin only) and public media serving.
 *
 * Server-only module — never import from client code.
 */
import { readFile } from "node:fs/promises";
import { getDb, type DbRow } from "./db";
import { ApiError } from "./http";
import { uid } from "./auth";
import { SITE_MEDIA_DIR, siteMediaPath, ensureUploadsDirs } from "./uploads";

export type NewsItem = {
  id: string;
  titleAr: string;
  titleFr?: string;
  titleEn?: string;
  body: string;
  cover?: string;
  date: string;
  published: boolean;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

function toNewsItem(row: DbRow): NewsItem {
  return {
    id: String(row.id),
    titleAr: String(row.title_ar),
    titleFr: row.title_fr ? String(row.title_fr) : undefined,
    titleEn: row.title_en ? String(row.title_en) : undefined,
    body: String(row.body),
    cover: row.cover ? String(row.cover) : undefined,
    date: String(row.news_date),
    published: Boolean(row.published),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export type NewsInput = {
  titleAr?: unknown;
  titleFr?: unknown;
  titleEn?: unknown;
  body?: unknown;
  cover?: unknown;
  date?: unknown;
  published?: unknown;
};

/** Returns published news ordered newest-first. */
export async function listPublishedNews(): Promise<NewsItem[]> {
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title_ar, title_fr, title_en, body, cover, news_date, published, updated_by, created_at, updated_at
     FROM site_news WHERE published = true ORDER BY news_date DESC, created_at DESC`,
  );
  return result.rows.map(toNewsItem);
}

/** Returns all news items (used by the super_admin console). */
export async function listAllNews(): Promise<NewsItem[]> {
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title_ar, title_fr, title_en, body, cover, news_date, published, updated_by, created_at, updated_at
     FROM site_news ORDER BY news_date DESC, created_at DESC`,
  );
  return result.rows.map(toNewsItem);
}

async function findNewsItem(id: string): Promise<NewsItem | null> {
  const result = await (
    await getDb()
  ).query(
    `SELECT id, title_ar, title_fr, title_en, body, cover, news_date, published, updated_by, created_at, updated_at
     FROM site_news WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ? toNewsItem(result.rows[0]) : null;
}

function cleanStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createNewsItem(input: NewsInput, actorName: string): Promise<NewsItem> {
  const titleAr = cleanStr(input.titleAr);
  const body = cleanStr(input.body);
  if (!titleAr) throw new ApiError("عنوان الخبر بالعربية مطلوب");
  if (!body) throw new ApiError("نص الخبر مطلوب");
  const id = uid("news");
  const now = new Date().toISOString();
  const date = cleanStr(input.date) || now.slice(0, 10);
  await (
    await getDb()
  ).query(
    `INSERT INTO site_news (id, title_ar, title_fr, title_en, body, cover, news_date, published, updated_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      titleAr,
      cleanStr(input.titleFr),
      cleanStr(input.titleEn),
      body,
      cleanStr(input.cover),
      date,
      typeof input.published === "boolean" ? input.published : true,
      actorName,
      now,
    ],
  );
  return (await findNewsItem(id)) as NewsItem;
}

export async function updateNewsItem(id: string, input: NewsInput, actorName: string): Promise<NewsItem> {
  const existing = await findNewsItem(id);
  if (!existing) throw new ApiError("الخبر غير موجود", 404);
  const titleAr = input.titleAr !== undefined ? cleanStr(input.titleAr) : existing.titleAr;
  const body = input.body !== undefined ? cleanStr(input.body) : existing.body;
  if (!titleAr) throw new ApiError("عنوان الخبر بالعربية مطلوب");
  if (!body) throw new ApiError("نص الخبر مطلوب");
  const now = new Date().toISOString();
  await (
    await getDb()
  ).query(
    `UPDATE site_news
     SET title_ar = $1, title_fr = $2, title_en = $3, body = $4, cover = $5, news_date = $6, published = $7,
         updated_by = $8, updated_at = $9
     WHERE id = $10`,
    [
      titleAr,
      input.titleFr !== undefined ? cleanStr(input.titleFr) : (existing.titleFr ?? ""),
      input.titleEn !== undefined ? cleanStr(input.titleEn) : (existing.titleEn ?? ""),
      body,
      input.cover !== undefined ? cleanStr(input.cover) : (existing.cover ?? ""),
      input.date !== undefined ? cleanStr(input.date) : existing.date,
      input.published !== undefined ? Boolean(input.published) : existing.published,
      actorName,
      now,
      id,
    ],
  );
  return (await findNewsItem(id)) as NewsItem;
}

export async function deleteNewsItem(id: string): Promise<void> {
  await (await getDb()).query("DELETE FROM site_news WHERE id = $1", [id]);
}

/**
 * Serves a previously uploaded public media file (news covers).
 * Returns a fetched Buffer — never used for arbitrary paths.
 */
export async function readSiteMedia(storedName: string): Promise<Buffer> {
  ensureUploadsDirs();
  if (!storedName || storedName.includes("..") || storedName.includes("/") || storedName.includes("\\")) {
    throw new ApiError("ملف غير موجود", 404);
  }
  try {
    return await readFile(siteMediaPath(storedName));
  } catch {
    throw new ApiError("ملف غير موجود", 404);
  }
}

export { SITE_MEDIA_DIR };