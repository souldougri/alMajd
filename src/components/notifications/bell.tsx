import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { fetchNotifications, markRead, type NotificationRow } from "@/lib/notifications";
import { formatPrintDate } from "@/lib/print";

const EDGE = 8;
const MAX_WIDTH = 352;

type PanelPos = { top: number; right: number } | null;

function computePanelPos(): PanelPos {
  const el = document.querySelector<HTMLElement>("[data-notification-bell-trigger]");
  const rect = el?.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const width = Math.min(MAX_WIDTH, vw - EDGE * 2);
  // Anchor the panel to the end edge of the trigger, then clamp so it always
  // stays fully inside the viewport (small phones, Capacitor WebView, RTL).
  const alignEnd = rect ? vw - rect.right : vw - EDGE - width;
  const right = Math.min(Math.max(alignEnd, EDGE), Math.max(EDGE, vw - width - EDGE));
  const top = (rect?.bottom ?? EDGE) + EDGE;
  return { top, right };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos>(null);
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

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reposition while open: viewport resizes, orientation changes, or the
  // drawer/header layout shifts (small phones + Capacitor WebView).
  useEffect(() => {
    if (!open) return;
    function onResize() {
      setPos(computePanelPos());
    }
    setPos(computePanelPos());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
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

  const maxHeight = pos ? `calc(100dvh - ${pos.top}px - ${EDGE}px)` : `min(24rem, 60dvh)`;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-notification-bell-trigger
        onClick={openDropdown}
        aria-label="الإشعارات"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex size-11 items-center justify-center rounded-full border border-navy/15 text-navy transition-colors hover:border-gold hover:text-gold"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && pos ? (
        <div
          role="dialog"
          aria-label="الإشعارات"
          style={{ top: pos.top, right: pos.right, maxHeight, width: Math.min(MAX_WIDTH, document.documentElement.clientWidth - EDGE * 2) }}
          className="fixed z-[90] flex flex-col overflow-hidden am-card shadow-xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-navy/10 bg-cream px-4 py-3">
            <div className="min-w-0">
              <p className="font-bold text-navy">الإشعارات</p>
              <p className="text-xs text-navy/55">{unread > 0 ? `${unread} غير مقروء` : "جميع الإشعارات مقروءة"}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق الإشعارات"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy transition-colors hover:border-gold hover:text-gold"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
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
                        <p className="text-sm font-bold break-words text-navy">{n.title}</p>
                        {n.body ? <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed text-navy/65">{n.body}</p> : null}
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