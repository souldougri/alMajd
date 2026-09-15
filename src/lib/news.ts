import { api } from "./api";

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

export type NewsDraft = {
  titleAr: string;
  titleFr?: string;
  titleEn?: string;
  body: string;
  cover?: string;
  date: string;
  published: boolean;
};

export function toNewsDraft(item: NewsItem): NewsDraft {
  return {
    titleAr: item.titleAr,
    titleFr: item.titleFr,
    titleEn: item.titleEn,
    body: item.body,
    cover: item.cover,
    date: item.date,
    published: item.published,
  };
}

/** Public list (published items only). */
export function fetchPublicNews(): Promise<NewsItem[]> {
  return api
    .get<{ items: NewsItem[] }>("/api/news")
    .then((res) => (res.ok ? (res.data?.items ?? []) : []));
}

/** Super_admin manage list (published + drafts). Requires admin session. */
export function fetchAdminNews(): Promise<{ items: NewsItem[]; error?: string }> {
  return api
    .get<{ items: NewsItem[] }>("/api/news/manage")
    .then((res) => (res.ok ? { items: res.data?.items ?? [] } : { items: [], error: res.error }));
}

export function createNews(item: NewsDraft): Promise<{ item?: NewsItem; error?: string }> {
  return api
    .post<{ item: NewsItem }>("/api/news", item)
    .then((res) => (res.ok ? { item: res.data?.item } : { error: res.error }));
}

export function updateNews(id: string, item: NewsDraft): Promise<{ item?: NewsItem; error?: string }> {
  return api
    .put<{ item: NewsItem }>(`/api/news/${id}`, item)
    .then((res) => (res.ok ? { item: res.data?.item } : { error: res.error }));
}

export function deleteNews(id: string): Promise<{ error?: string }> {
  return api
    .del<{ deleted: boolean }>(`/api/news/${id}`)
    .then((res) => (res.ok ? {} : { error: res.error }));
}

/** Uploads a cover image; returns the public /media URL or an error message. */
export function uploadNewsCover(file: File): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  return api
    .upload<{ url: string }>("/api/media/cover", form)
    .then((res) => (res.ok ? { url: res.data?.url } : { error: res.error }));
}