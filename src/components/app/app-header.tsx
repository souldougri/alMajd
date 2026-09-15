import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { ROLE_LABELS } from "@/lib/auth/types";
import { useSchool } from "@/lib/store";
import { SCHOOL } from "@/lib/school";
import { NotificationBell } from "@/components/notifications/bell";

export function AppHeader() {
  const user = useAuth((s) => s.currentUser);
  const logout = useAuth((s) => s.logout);
  const setView = useSchool((s) => s.setView);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
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
            className="flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            <LogOut className="size-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}