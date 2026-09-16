import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { SCHOOL } from "@/lib/school";
import { BRAND } from "@/lib/brand";

/**
 * Portal splash screen: full-page navy/gold welcome shown instead of the
 * marketing homepage. Pure static branding — no CMS/settings fetch required.
 */
export function PortalLanding() {
  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12"
      style={{ backgroundColor: BRAND.navy, color: BRAND.white }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(42rem 24rem at 85% -5%, rgba(216,154,62,0.32), transparent 60%), radial-gradient(34rem 20rem at 10% 110%, rgba(216,154,62,0.18), transparent 55%)",
        }}
      />

      <div className="rise-in relative flex w-full max-w-md flex-col items-center gap-7 text-center">
        <img
          src={SCHOOL.logo}
          alt={SCHOOL.nameAr}
          className="seal size-28 rounded-full border-4 object-cover sm:size-32"
          style={{
            borderColor: BRAND.gold,
            boxShadow: "0 12px 44px -18px rgba(216,154,62,0.6)",
          }}
        />

        <div className="space-y-3">
          <p
            className="text-xs font-semibold tracking-[0.32em]"
            style={{ color: BRAND.goldLight }}
          >
            {SCHOOL.nameEn.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-bold leading-snug sm:text-4xl">
            {SCHOOL.nameAr}
          </h1>
          <p className="text-sm text-white/75">{SCHOOL.motto}</p>
        </div>

        <a
          href="/login"
          className="mt-2 flex items-center gap-2 rounded-full bg-gold px-10 py-3.5 text-lg font-bold text-navy transition-opacity hover:opacity-90"
        >
          <LogIn className="size-5" />
          دخول
        </a>
      </div>

      <p className="relative mt-12 text-xs text-white/50">
        © {new Date().getFullYear()} {SCHOOL.nameEn} — {SCHOOL.city}،{" "}
        {SCHOOL.countryAr}
      </p>
    </main>
  );
}
