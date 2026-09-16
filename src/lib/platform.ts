/**
 * Lightweight client platform detection.
 *
 * The same web app runs in browsers, Electron and the Capacitor Android
 * WebView. Native `window.print()` is reliable in desktop browsers and
 * Electron, but is unreliable (or a no-op) inside the Android WebView, so the
 * UI routes those cases to a PDF fallback.
 */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}