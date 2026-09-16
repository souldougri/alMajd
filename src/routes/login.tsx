import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { isPortalMode } from "@/lib/mode";
import { SCHOOL } from "@/lib/school";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [{ title: `تسجيل الدخول | ${SCHOOL.nameAr}` }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ backgroundColor: BRAND.bg }}
    >
      <div className="bg-navy py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={SCHOOL.logo}
              alt={SCHOOL.nameAr}
              className="size-10 rounded-full border border-gold/40 object-cover"
            />
            <div className="leading-tight">
              <p className="font-bold">{SCHOOL.nameAr}</p>
              <p className="text-xs text-gold-light">{SCHOOL.nameEn}</p>
            </div>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm text-white/85 transition-colors hover:border-gold hover:text-gold"
          >
            <ArrowRight className="size-4" />
            <span>{isPortalMode() ? "العودة للواجهة" : "العودة للموقع"}</span>
          </Link>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-navy/10 ring-1 ring-gold/15 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-navy">
              <img
                src={SCHOOL.logo}
                alt={SCHOOL.nameAr}
                className="size-12 rounded-full object-cover"
              />
            </div>
            <h1 className="font-display text-2xl font-bold text-navy">
              تسجيل الدخول
            </h1>
            <p className="mt-1 text-sm text-navy/60">{SCHOOL.motto}</p>
          </div>
          <LoginForm initialRedirect={redirect} />
        </div>
      </main>

      <footer className="bg-navy-dark py-5 text-center text-xs text-white/60">
        Copyright © {new Date().getFullYear()} {SCHOOL.nameEn}
      </footer>
    </div>
  );
}
