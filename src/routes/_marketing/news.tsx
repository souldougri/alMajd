import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Newspaper } from "lucide-react";
import { SCHOOL } from "@/lib/school";
import { useI18n } from "@/lib/i18n";
import { fetchPublicNews, type NewsItem } from "@/lib/news";
import { formatPrintDate } from "@/lib/print";

export const Route = createFileRoute("/_marketing/news")({
  component: NewsPage,
  head: () => ({
    meta: [{ title: `News | ${SCHOOL.nameEn} | ${SCHOOL.nameAr}` }],
  }),
});

export default function NewsPage() {
  const { locale } = useI18n();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicNews()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setError("تعذر تحميل الأخبار");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const titleOf = (item: NewsItem) =>
    locale === "fr" && item.titleFr
      ? item.titleFr
      : locale === "en" && item.titleEn
        ? item.titleEn
        : item.titleAr;

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="font-display text-4xl font-bold text-navy">
          {locale === "ar" ? "الأخبار والإعلانات" : locale === "fr" ? "Actualités" : "News & Announcements"}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-navy/60">
          <Loader2 className="size-6 animate-spin text-gold" />
          <span className="text-sm">
            {locale === "ar" ? "جارٍ التحميل..." : locale === "fr" ? "Chargement..." : "Loading..."}
          </span>
        </div>
      ) : error ? (
        <p className="py-16 text-center text-sm text-danger">{error}</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-navy">
            <Newspaper className="size-7" />
          </div>
          <p className="mt-4 text-sm text-navy/55">
            {locale === "ar"
              ? "لا توجد أخبار منشورة بعد."
              : locale === "fr"
                ? "Aucune actualité publiée pour le moment."
                : "No published news yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-gold/20 bg-white shadow-sm">
              {item.cover ? (
                <img src={item.cover} alt={item.titleAr} className="h-56 w-full object-cover" />
              ) : (
                <div className="flex items-center gap-3 border-b border-navy/5 bg-cream px-6 py-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-navy text-gold">
                    <Newspaper className="size-5" />
                  </div>
                  <time className="text-sm font-semibold text-gold">{formatPrintDate(item.date)}</time>
                </div>
              )}
              <div className="p-7">
                {item.cover ? (
                  <time className="text-sm font-semibold text-gold">{formatPrintDate(item.date)}</time>
                ) : null}
                <h2 className="mt-2 font-display text-xl font-bold text-navy">{titleOf(item)}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-navy/75">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}