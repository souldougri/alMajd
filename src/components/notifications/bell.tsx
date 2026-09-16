import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { fetchNotifications, markRead, type NotificationRow } from "@/lib/notifications";
import { formatPrintDate } from "@/lib/print";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then((result) => {
        if (cancelled) return;
        setItems(result.notifications);
        setUnread(result.unreadCount);
      })
      .catch(() => {
        if (!cancelled) setError("تعذر تحميل الإشعارات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openDropdown() {
    const willOpen = !open;
    setOpen(willOpen);
    if (!willOpen) return;
    if (unread === 0) return;
    await markRead();
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={openDropdown}
        aria-label="الإشعارات"
        className="relative flex size-11 items-center justify-center rounded-full border border-navy/15 text-navy transition-colors hover:border-gold hover:text-gold"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-xl">
          <div className="border-b border-navy/10 bg-cream px-4 py-3">
            <p className="font-bold text-navy">الإشعارات</p>
            <p className="text-xs text-navy/55">{unread > 0 ? `${unread} غير مقروء` : "جميع الإشعارات مقروءة"}</p>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-navy/50">جارٍ التحميل...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-navy/50">{error}</p>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-navy/50">لا توجد إشعارات بعد.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((n) => (
                  <li key={n.id} className="rounded-xl px-3 py-2.5 hover:bg-cream">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy">{n.title}</p>
                        {n.body ? <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-navy/65">{n.body}</p> : null}
                      </div>
                      <span className={`mt-1 size-2 shrink-0 rounded-full ${n.read ? "bg-navy/15" : "bg-gold"}`} />
                    </div>
                    <p className="mt-1 text-[11px] text-navy/45">{formatPrintDate(n.createdAt.slice(0, 10))}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}