/** Build-time deployment mode: public marketing website or the school portal. */
export type AppMode = "site" | "portal";

const rawMode = (import.meta.env.VITE_APP_MODE as string | undefined)
  ?.trim()
  .toLowerCase();

/** Defaults to `site` so existing marketing URLs keep working unchanged. */
export const APP_MODE: AppMode = rawMode === "portal" ? "portal" : "site";

/** Public origin of the portal app (e.g. https://app.example.com). */
export const PORTAL_URL: string | undefined = import.meta.env
  .VITE_PORTAL_URL as string | undefined;

/** Public origin of the marketing site (e.g. https://www.example.com). */
export const SITE_URL: string | undefined = import.meta.env.VITE_SITE_URL as
  string | undefined;

export function isPortalMode(): boolean {
  return APP_MODE === "portal";
}

export function isSiteMode(): boolean {
  return APP_MODE === "site";
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Target for the marketing «تسجيل الدخول» button.
 *
 * - Portal build → same-origin `/login`.
 * - Site build with VITE_PORTAL_URL → absolute URL on the portal origin.
 * - Site build without VITE_PORTAL_URL → local `/login` (monolithic deploy).
 */
export function marketingLoginHref(): string {
  if (isPortalMode()) return "/login";
  return PORTAL_URL ? `${withoutTrailingSlash(PORTAL_URL)}/login` : "/login";
}
