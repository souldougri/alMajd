import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/auth/store";

/**
 * Renders for any unmatched URL. Paths under /app are desktop/app addresses:
 * a logged-out visitor is always sent to the login screen (never shown the
 * marketing 404), and an authenticated user is sent to the app home.
 */
export function AppNotFoundComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useAuth((s) => s.hydrate);
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname.startsWith("/app/")) {
      if (status === "loading") {
        void hydrate();
        return;
      }
      void navigate({ to: status === "authenticated" ? "/app" : "/login" });
    }
  }, [pathname, status, hydrate, navigate]);

  if (pathname.startsWith("/app/")) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center" style={{ backgroundColor: BRAND.bg, color: BRAND.navy }}>
        <p className="text-sm font-semibold">{status === "loading" ? "جارٍ التحقق من الجلسة…" : "جارٍ التحويل…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60dvh]" style={{ backgroundColor: BRAND.bg, color: BRAND.navy }}>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <p className="font-display text-7xl font-bold" style={{ color: BRAND.gold }}>
          404
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-navy/60">يبدو أن الرابط الذي تتبعه لا يعمل.</p>
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          className="mt-8 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-navy transition-opacity hover:opacity-90"
        >
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}