import { useEffect, useState } from "react";
import { ExternalLink, ImageIcon, Loader2, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createNews,
  deleteNews,
  fetchAdminNews,
  updateNews,
  uploadNewsCover,
  type NewsItem,
} from "@/lib/news";
import { todayIso } from "@/lib/school";

export function NewsManager() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    fetchAdminNews().then((result) => {
      setItems(result.items);
      if (result.error) setError(result.error);
      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">أخبار الموقع</h1>
          <p className="mt-1 text-sm text-navy/60">تُعرض الأخبار المنشورة على الصفحة العامة للموقع (مقتضبة) وصفحة الأخبار.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingId("__new__")}
          className="flex h-10 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-gold transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          خبر جديد
        </button>
      </div>

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

      {editingId ? (
        <NewsEditor
          key={editingId}
          initial={editingId === "__new__" ? null : (items.find((i) => i.id === editingId) ?? null)}
          onDone={(saved) => {
            setEditingId(null);
            if (saved) reload();
          }}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
        <div className="border-b border-navy/10 px-5 py-3">
          <h2 className="font-bold text-navy">القائمة</h2>
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-navy/50">
            <Loader2 className="size-5 animate-spin text-gold" />
            جارٍ التحميل...
          </p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-navy/50">لا توجد أخبار بعد — أضف أول خبر.</p>
        ) : (
          <ul className="divide-y divide-navy/5">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {item.cover ? (
                  <img src={item.cover} alt="" className="size-12 rounded-lg border border-navy/10 object-cover" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg bg-cream text-navy/40">
                    <Newspaper className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-navy">{item.titleAr}</p>
                  <p className="text-xs text-navy/50">
                    {item.date}
                    {item.published ? " · منشور" : " · مسودة"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="flex size-9 items-center justify-center rounded-lg text-navy/70 transition-colors hover:bg-cream hover:text-navy"
                    aria-label="تعديل"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("حذف هذا الخبر نهائيًا؟")) return;
                      const result = await deleteNews(item.id);
                      if (result.error) setError(result.error);
                      else reload();
                    }}
                    className="flex size-9 items-center justify-center rounded-lg text-navy/70 transition-colors hover:bg-danger hover:text-white"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewsEditor({
  initial,
  onDone,
}: {
  initial: NewsItem | null;
  onDone: (saved: boolean) => void;
}) {
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? "");
  const [titleFr, setTitleFr] = useState(initial?.titleFr ?? "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [cover, setCover] = useState(initial?.cover ?? "");
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [published, setPublished] = useState(initial?.published ?? true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCover(file: File | null) {
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    const result = await uploadNewsCover(file);
    setUploadingCover(false);
    if (result.url) setCover(result.url);
    else if (result.error) setError(result.error);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const draft = { titleAr, titleFr: titleFr.trim(), titleEn: titleEn.trim(), body, cover, date, published };
    const result = initial ? await updateNews(initial.id, draft) : await createNews(draft);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone(true);
  }

  return (
    <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-navy">{initial ? "تعديل الخبر" : "خبر جديد"}</h2>
      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy/60">
            العنوان (عربي) <span className="text-danger">*</span>
          </span>
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">العنوان (فرنسي)</span>
            <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">العنوان (إنجليزي)</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy/60">
            نص الخبر <span className="text-danger">*</span>
          </span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full rounded-xl border border-navy/15 bg-surface px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">التاريخ</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-xl border border-navy/15 bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-navy/60">صورة الغلاف</span>
            {cover ? (
              <div className="flex items-center gap-3">
                <img src={cover} alt="" className="size-11 rounded-lg border border-navy/10 object-cover" />
                <button type="button" onClick={() => setCover("")} className="text-xs font-bold text-danger hover:underline">
                  إزالة
                </button>
              </div>
            ) : (
              <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy/25 text-sm text-navy/60 hover:border-gold">
                {uploadingCover ? <Loader2 className="size-4 animate-spin text-gold" /> : <ImageIcon className="size-4" />}
                {uploadingCover ? "جارٍ الرفع..." : "رفع صورة"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCover(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </label>
          <label className="flex h-11 items-center gap-2 pt-5">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-4 accent-navy" />
            <span className="text-sm font-semibold text-navy/70">منشور على الموقع</span>
          </label>
        </div>

        {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving || !titleAr.trim() || !body.trim()}
            className="flex h-10 items-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-gold transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button type="button" onClick={() => onDone(false)} className="h-10 rounded-full px-4 text-sm font-bold text-navy/60 hover:bg-cream">
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => window.open("/news", "_blank")}
            className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-navy/60 hover:bg-cream"
          >
            <ExternalLink className="size-4" />
            معاينة الصفحة العامة
          </button>
        </div>
      </div>
    </section>
  );
}