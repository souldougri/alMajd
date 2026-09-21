import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, LogOut, Menu, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { ROLE_LABELS } from "@/lib/auth/types";
import { useSchool } from "@/lib/store";
import { SCHOOL } from "@/lib/school";
import { NotificationBell } from "@/components/notifications/bell";
import { useSchoolSync } from "@/lib/use-school-sync";
import { cn } from "@/lib/utils";

export type AppNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Highlight the current page in the drawer. */
  active?: boolean;
  /** Optional route; renders the item as a router Link when provided. */
  to?: string;
  /** Optional callback; rendered as a button when `to` is absent. */
  onSelect?: () => void;
};

export type AppNav = {
  title: string;
  items: AppNavItem[];
  footer?: ReactNode;
};

export function AppHeader({ nav }: { nav?: AppNav }) {
  const user = useAuth((s) => s.currentUser);
  const logout = useAuth((s) => s.logout);
  const setView = useSchool((s) => s.setView);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Hydrate the school document from the server for every logged-in shell
  // (admin/staff/dashboard included), so statistics render on first visit
  // without needing to open another workspace first.
  useSchoolSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while the drawer is open and close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  const hasMenu = Boolean(nav && nav.items.length > 0);

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white shadow-sm">
      <div className="h-0.5 w-full bg-gradient-to-l from-gold via-gold-light to-navy" aria-hidden="true" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {hasMenu ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              aria-controls="app-drawer"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy transition-colors hover:border-gold hover:text-gold lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          ) : null}
          <img src={SCHOOL.logo} alt={SCHOOL.nameAr} className="size-10 rounded-full border border-gold/40 object-cover" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-bold text-navy">{SCHOOL.nameAr}</p>
            <p className="truncate text-xs text-navy/55">{SCHOOL.nameEn}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mounted && user ? (
            <>
              <NotificationBell />
              <div className="hidden text-end sm:block">
                <p className="text-sm font-bold text-navy">{user.nameAr}</p>
                <p className="text-xs text-navy/55">
                  {ROLE_LABELS[user.role]?.ar ?? user.role}
                  <span className="mx-1 text-gold">•</span>
                  <span dir="ltr">{user.email}</span>
                </p>
              </div>
              <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-gold sm:hidden">
                {ROLE_LABELS[user.role]?.ar ?? user.role}
              </span>
            </>
          ) : null}
          {mounted && user?.role === "super_admin" ? (
            <Link
              to="/app/admin"
              className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-navy transition-colors hover:bg-gold hover:text-navy"
            >
              <ShieldCheck className="size-3.5" />
              لوحة المدير
            </Link>
          ) : null}
          <Link
            to="/"
            className="hidden items-center gap-1.5 rounded-full border border-navy/15 px-3 py-1.5 text-xs text-navy transition-colors hover:border-gold hover:text-gold sm:flex"
            onClick={() => {
              if (!mounted || !user) setView("home");
            }}
          >
            <ExternalLink className="size-3.5" />
            <span>الموقع</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            <LogOut className="size-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {hasMenu ? (
        <>
          {/* Overlay – closes the drawer */}
          {menuOpen ? (
            <div
              className="fixed inset-0 z-[60] bg-navy/45 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
          ) : null}

          {/* Right-side RTL drawer */}
          <aside
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={nav?.title}
            className={cn(
              "fixed inset-y-0 right-0 z-[70] flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden",
              menuOpen ? "translate-x-0" : "invisible translate-x-full",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-navy/10 px-4">
              <p className="truncate font-display text-lg font-bold text-navy">{nav?.title}</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="إغلاق القائمة"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy transition-colors hover:border-gold hover:text-gold"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {nav?.items.map((item) => {
                const inner = (
                  <>
                    <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{item.label}</span>
                  </>
                );
                const cls = cn(
                  "flex h-11 w-full items-center gap-3 rounded-md px-3 text-start text-sm transition-colors",
                  item.active ? "bg-navy text-gold" : "text-navy/60 hover:bg-cream hover:text-navy",
                );
                if (item.to) {
                  return (
                    <Link key={item.id} to={item.to} onClick={() => setMenuOpen(false)} className={cls}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.onSelect?.();
                      setMenuOpen(false);
                    }}
                    className={cls}
                  >
                    {inner}
                  </button>
                );
              })}
            </nav>
            {nav?.footer ? <div className="shrink-0 border-t border-navy/10 p-3">{nav.footer}</div> : null}
          </aside>
        </>
      ) : null}
    </header>
  );
}